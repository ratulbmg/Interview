import { InterviewSession, Candidate, Role, Prisma } from "@repo/db/client";
import { enqueueEmail } from "@repo/mailer";
import { InterviewSessionStatus } from "../enum";
import { apiError } from "../utils/apiError";
import {
  ScheduleSessionRequest,
  TranscriptTurn,
  SelectedQuestionDto,
  SessionResult,
  DisconnectUsageDto,
} from "../model/sessionModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { meetingProvider } from "../lib/meetingProvider";
import { agentQueue, AgentStartJob } from "../lib/agentQueue";
import {
  orchestratorQueue,
  NoShowCheckJob,
  InterviewTimeoutFinalizeJob,
} from "../lib/orchestratorQueue";
import { scoreInterview } from "../lib/agentClient";
import { delayUntil, MINUTES, DAYS } from "../lib/scheduling";
import { computeEligibility } from "../lib/eligibility";

type SessionWithRelations = InterviewSession & {
  candidate: Candidate;
  role: Role;
};

// Re-exported so controllers/etc. can import these DTOs from the service
// alongside JoinInstruction, without needing to know they actually live in
// model/sessionModel.ts (kept there to avoid a circular import with
// lib/agentClient.ts, which also needs them).
export type { TranscriptTurn, SelectedQuestionDto, SessionResult };

/**
 * The single decision apps/api hands back to apps/engine for
 * "what do I do for this room token" (POST /agent/rooms/join) — the
 * agent is a pure executor of whichever variant comes back, including
 * speaking the exact `message` text verbatim.
 */
export type JoinInstruction =
  | { action: "speak_and_end"; message: string }
  | {
      action: "start";
      sessionId: number;
      candidateName: string;
      roleName: string;
      selectedQuestions: SelectedQuestionDto[];
    }
  | {
      action: "resume";
      sessionId: number;
      candidateName: string;
      roleName: string;
      selectedQuestions: SelectedQuestionDto[];
      priorTranscript: TranscriptTurn[];
    };

// Candidate-facing copy — verbatim strings the agent speaks when it gets
// back a "speak_and_end" instruction. Keep in sync with
// packages/mailer's MeetingLinkEmail.tsx, which tells the candidate the
// same join-window number.
export const MSG_NOT_READY =
  "Your interview hasn't started yet. Please come back at your scheduled time — you'll be able to join a couple of minutes early.";
export const MSG_EXPIRED =
  "This interview link has expired. Please reach out to your recruiter to reschedule.";
export const MSG_ALREADY_COMPLETED =
  "Your interview has already been completed. Please wait for further communication from your recruiter.";

/** How long after scheduledAt a candidate can still start an interview for
 * the first time, or resume one they disconnected from without ending it
 * deliberately. Must stay in sync with JOIN_WINDOW_MINUTES in
 * apps/engine/agent/voice/server.py and with
 * scheduleInterviewTimeoutFinalize's offset below. */
const JOIN_WINDOW_MINUTES = 30;

type CheckpointData = {
  transcript: TranscriptTurn[];
  selectedQuestions: SelectedQuestionDto[];
};

/** Session.checkpointJson is a loosely-typed Prisma Json? column written
 * by this same service (saveSelectedQuestions, reportDisconnect) — this
 * just narrows it back defensively rather than trusting the DB blindly. */
function readCheckpoint(
  checkpointJson: Prisma.JsonValue | null,
): CheckpointData | null {
  if (
    checkpointJson === null ||
    typeof checkpointJson !== "object" ||
    Array.isArray(checkpointJson)
  ) {
    return null;
  }
  const obj = checkpointJson as Record<string, unknown>;
  return {
    transcript: Array.isArray(obj.transcript)
      ? (obj.transcript as TranscriptTurn[])
      : [],
    selectedQuestions: Array.isArray(obj.selectedQuestions)
      ? (obj.selectedQuestions as SelectedQuestionDto[])
      : [],
  };
}

class SessionService {
  async listSessions(userId: number): Promise<InterviewSession[]> {
    return repositoryWrapper.sessionRepository.findAllForUser(userId);
  }

  /** Backs the recruiter-facing Results screen — every scored session,
   * each with the Eligible/Not Eligible verdict derived from its report
   * (see lib/eligibility.ts). The frontend splits this one list into its
   * two tabs by `eligible`, rather than this returning two separate lists —
   * simpler for a set that's this small and never paginated. */
  async listResults(userId: number): Promise<SessionResult[]> {
    const sessions =
      (await repositoryWrapper.sessionRepository.findCompletedWithReportsForUser(
        userId,
      )) as SessionWithRelations[];

    return sessions
      .map((session): SessionResult | null => {
        const eligibility = computeEligibility(session.reportJson);
        if (!eligibility) {
          // reportJson exists (query already filtered on that) but isn't a
          // recognizable ScoringResult — an old report shape from before
          // this scoring system existed. Leave it out rather than show a
          // misleading 0%.
          return null;
        }
        return {
          sessionId: session.id,
          candidateName: session.candidate.name ?? session.candidate.email,
          candidateEmail: session.candidate.email,
          roleName: session.role.name,
          scheduledAt: session.scheduledAt.toISOString(),
          ...eligibility,
        };
      })
      .filter((result): result is SessionResult => result !== null);
  }

  async getSession(id: number, userId: number): Promise<InterviewSession> {
    const session = await repositoryWrapper.sessionRepository.findByIdForUser(
      id,
      userId,
    );
    if (!session) {
      throw new apiError("Session not found", 404);
    }
    return session;
  }

  /** Deletes only this one session — the candidate and any of their other
   * sessions are untouched (unlike candidateService.deleteCandidate, which
   * cascades the other direction). A session that exists but belongs to
   * another recruiter is treated identically to one that doesn't exist. */
  async deleteSession(id: number, userId: number): Promise<void> {
    const existing = await repositoryWrapper.sessionRepository.findByIdForUser(
      id,
      userId,
    );
    if (!existing) {
      throw new apiError("Session not found", 404);
    }
    await repositoryWrapper.sessionRepository.delete(id);
  }

  /** Scheduling is a second, separate action from adding the candidate —
   * this only creates the session record; nothing is sent to the candidate
   * until sendInvite() below is called. `createdById` is the recruiter
   * scheduling this interview (from the authenticated request, never client
   * input) — it's what agent-start (below) tells apps/engine to select this
   * session's questions from, since each recruiter has their own question
   * bank (see packages/db/prisma/schema.prisma's Question.createdBy). */
  async scheduleSession(
    data: ScheduleSessionRequest,
    createdById: number,
  ): Promise<InterviewSession> {
    // Ownership-scoped, not the generic findById — a recruiter can only
    // schedule using their own candidates and their own roles, never
    // another recruiter's.
    const candidate =
      await repositoryWrapper.candidateRepository.findByIdForUser(
        data.candidateId,
        createdById,
      );
    if (!candidate) {
      throw new apiError("Candidate not found", 404);
    }

    const role = await repositoryWrapper.roleRepository.findByIdForUser(
      data.roleId,
      createdById,
    );
    if (!role) {
      throw new apiError("Role not found", 404);
    }

    return repositoryWrapper.sessionRepository.create({
      candidate: { connect: { id: candidate.id } },
      role: { connect: { id: role.id } },
      createdBy: { connect: { id: createdById } },
      scheduledAt: new Date(data.scheduledAt),
    });
  }

  /**
   * Pressing "Send Invite" is the recruiter's last required action.
   * Everything from here runs on its own: a meeting URL is minted, the
   * session moves to INVITE_SENT, and three emails plus one agent-start
   * job are scheduled as delayed jobs off scheduledAt — not three separate
   * recruiter actions.
   */
  async sendInvite(
    id: number,
    userId: number,
  ): Promise<InterviewSession> {
    const session = (await repositoryWrapper.sessionRepository.findByIdForUser(
      id,
      userId,
    )) as SessionWithRelations | null;
    if (!session) {
      throw new apiError("Session not found", 404);
    }
    if (session.status !== InterviewSessionStatus.SCHEDULED) {
      throw new apiError("Invite has already been sent for this session", 409);
    }

    const { meetingUrl } = await meetingProvider.createMeeting({
      id: session.id,
      scheduledAt: session.scheduledAt,
    });

    const updated = await repositoryWrapper.sessionRepository.update(id, {
      status: InterviewSessionStatus.INVITE_SENT,
      meetingUrl,
    });

    await this.scheduleEmails(session, meetingUrl);
    await this.scheduleAgentStart(session, meetingUrl);
    await this.scheduleNoShowCheck(session);
    await this.scheduleInterviewTimeoutFinalize(session);

    return updated;
  }

  private async scheduleEmails(
    session: SessionWithRelations,
    meetingUrl: string,
  ): Promise<void> {
    const to = session.candidate.email;
    const candidateName = session.candidate.name ?? session.candidate.email;
    const roleName = session.role.name;
    const scheduledAt = session.scheduledAt.toISOString();

    // Stage 1: enqueued immediately on click.
    await enqueueEmail({
      type: "interview-invite",
      data: { to, candidateName, roleName, scheduledAt },
    });

    // Stage 2: 2 days before, or immediately if under 2 days remain.
    await enqueueEmail(
      {
        type: "interview-followup",
        data: { to, candidateName, roleName, scheduledAt },
      },
      { delay: delayUntil(session.scheduledAt, 2 * DAYS) },
    );

    // Stage 3: 1 day before — carries the actual join link.
    await enqueueEmail(
      {
        type: "interview-meeting-link",
        data: { to, candidateName, roleName, scheduledAt, meetingUrl },
      },
      { delay: delayUntil(session.scheduledAt, 1 * DAYS) },
    );
  }

  /**
   * apps/api is "the boss" for every session-lifecycle decision — this is
   * the one apps/engine's bot() function used to make itself by
   * querying Postgres directly (see the old apps/engine/agent/
   * voice/server.py and agent/db.py). Now the agent calls
   * POST /agent/rooms/join with just the room token and acts on whatever
   * comes back, including speaking the exact message text verbatim for
   * every "speak_and_end" outcome.
   */
  async getJoinInstruction(roomToken: string): Promise<JoinInstruction> {
    const session =
      (await repositoryWrapper.sessionRepository.findByRoomToken(
        roomToken,
      )) as SessionWithRelations | null;

    if (!session) {
      return { action: "speak_and_end", message: MSG_NOT_READY };
    }

    if (session.status === InterviewSessionStatus.COMPLETED) {
      return { action: "speak_and_end", message: MSG_ALREADY_COMPLETED };
    }

    if (
      session.status === InterviewSessionStatus.NO_SHOW ||
      session.status === InterviewSessionStatus.CANCELLED
    ) {
      return { action: "speak_and_end", message: MSG_EXPIRED };
    }

    const candidateName = session.candidate.name ?? session.candidate.email;
    const roleName = session.role.name;
    const deadline = new Date(
      session.scheduledAt.getTime() + JOIN_WINDOW_MINUTES * MINUTES,
    );
    const now = new Date();

    if (session.status === InterviewSessionStatus.IN_PROGRESS) {
      const checkpoint = readCheckpoint(session.checkpointJson) ?? {
        transcript: [],
        selectedQuestions: [],
      };

      if (now <= deadline) {
        return {
          action: "resume",
          sessionId: session.id,
          candidateName,
          roleName,
          selectedQuestions: checkpoint.selectedQuestions,
          priorTranscript: checkpoint.transcript,
        };
      }

      // Started, then disconnected without ending deliberately, and now
      // past the resume deadline. Tell the candidate right away — scoring
      // can take a while with a local LLM, nobody should sit on
      // "Connecting…" waiting for it — and finalize in the background with
      // whatever was captured.
      this.scoreAndFinalize(
        session.id,
        checkpoint.transcript,
        checkpoint.selectedQuestions,
        roleName,
      ).catch((error) => {
        console.error(
          `Failed to finalize abandoned session ${session.id}:`,
          error,
        );
      });
      return { action: "speak_and_end", message: MSG_ALREADY_COMPLETED };
    }

    // SCHEDULED or INVITE_SENT.
    if (now > deadline) {
      // Never started and now past the join window — a no-show.
      await repositoryWrapper.sessionRepository.update(session.id, {
        status: InterviewSessionStatus.NO_SHOW,
      });
      return { action: "speak_and_end", message: MSG_EXPIRED };
    }

    const checkpoint = readCheckpoint(session.checkpointJson);
    if (!checkpoint) {
      // agent-start hasn't fired yet (e.g. candidate clicked the link a
      // day early) — no questions selected yet, nothing to start.
      return { action: "speak_and_end", message: MSG_NOT_READY };
    }

    await repositoryWrapper.sessionRepository.update(session.id, {
      status: InterviewSessionStatus.IN_PROGRESS,
    });

    return {
      action: "start",
      sessionId: session.id,
      candidateName,
      roleName,
      selectedQuestions: checkpoint.selectedQuestions,
    };
  }

  /** Called once apps/engine has selected the interview's
   * questions (agent-start job) — the fresh-start half of
   * getJoinInstruction's SCHEDULED/INVITE_SENT branch is gated on this
   * having happened. */
  async saveSelectedQuestions(
    sessionId: number,
    selectedQuestions: SelectedQuestionDto[],
  ): Promise<void> {
    const existing = await repositoryWrapper.sessionRepository.findById(
      sessionId,
    );
    if (!existing) {
      throw new apiError("Session not found", 404);
    }
    const checkpoint: CheckpointData = { transcript: [], selectedQuestions };
    await repositoryWrapper.sessionRepository.update(sessionId, {
      checkpointJson: checkpoint as unknown as Prisma.InputJsonValue,
    });
  }

  /** Called once the candidate has heard and responded to the
   * recording/AI-evaluation notice at the start of the call — mirrors the
   * old apps/engine/agent/db.py's log_consent. */
  async recordConsent(sessionId: number): Promise<void> {
    const existing = await repositoryWrapper.sessionRepository.findById(
      sessionId,
    );
    if (!existing) {
      throw new apiError("Session not found", 404);
    }
    await repositoryWrapper.sessionRepository.update(sessionId, {
      consentGivenAt: new Date(),
    });
  }

  /**
   * Called on every candidate disconnect. A deliberate end (candidate
   * clicked "End Interview") is scored and finalized right away; anything
   * else just checkpoints the transcript-so-far so the candidate can
   * resume later (status stays whatever it already was — still
   * IN_PROGRESS) — interview-timeout-finalize catches it if they never
   * come back at all.
   */
  async reportDisconnect(
    sessionId: number,
    transcript: TranscriptTurn[],
    selectedQuestions: SelectedQuestionDto[],
    endedDeliberately: boolean,
    usage?: DisconnectUsageDto,
  ): Promise<void> {
    const session =
      (await repositoryWrapper.sessionRepository.findByIdWithRelations(
        sessionId,
      )) as SessionWithRelations | null;
    if (!session) {
      throw new apiError("Session not found", 404);
    }

    // Added to whatever this session already has, regardless of how this
    // disconnect turns out — a checkpoint-and-resume's next segment adds
    // more later; a deliberate end's segment is the last one. Never
    // skipped, so partial usage from an accidental drop still counts.
    if (usage) {
      await repositoryWrapper.sessionRepository.incrementUsage(sessionId, {
        llmPromptTokens: usage.llmPromptTokens ?? 0,
        llmCompletionTokens: usage.llmCompletionTokens ?? 0,
        sttAudioSeconds: usage.sttAudioSeconds ?? 0,
        ttsCharacters: usage.ttsCharacters ?? 0,
        interviewSeconds: usage.interviewSeconds ?? 0,
      });
    }

    if (endedDeliberately) {
      await this.scoreAndFinalize(
        sessionId,
        transcript,
        selectedQuestions,
        session.role.name,
      );
      return;
    }

    const checkpoint: CheckpointData = { transcript, selectedQuestions };
    await repositoryWrapper.sessionRepository.update(sessionId, {
      checkpointJson: checkpoint as unknown as Prisma.InputJsonValue,
    });
  }

  /** Calls apps/engine's /score endpoint (the one direction the
   * boss/executor relationship runs backwards — see agentClient.ts) and
   * finalizes with whatever comes back. Scoring failures are logged but
   * don't block finalizing the session with a null report — an interview
   * that fails to score shouldn't be stuck COMPLETED-less forever. */
  private async scoreAndFinalize(
    sessionId: number,
    transcript: TranscriptTurn[],
    selectedQuestions: SelectedQuestionDto[],
    roleName: string,
  ): Promise<void> {
    let report: unknown;
    try {
      const result = await scoreInterview(
        transcript,
        selectedQuestions,
        roleName,
      );
      report = result.report;
    } catch (error) {
      console.error(`Failed to score session ${sessionId}:`, error);
    }
    await this.finalizeSession(
      sessionId,
      transcript as unknown as Prisma.InputJsonValue,
      report as Prisma.InputJsonValue | undefined,
    );
  }

  /**
   * Stores the final transcript + score report, marks the session
   * COMPLETED, clears checkpointJson (nothing left to resume), and — if a
   * report came back — enqueues the recruiter's report-ready email. The
   * only two callers are scoreAndFinalize (above) and
   * orchestratorWorker.ts's interview-timeout-finalize handler; this used
   * to be reachable directly via a webhook apps/engine posted to
   * (receiveTranscript) before apps/api became the one deciding when a
   * session is done.
   */
  async finalizeSession(
    sessionId: number,
    transcript: Prisma.InputJsonValue,
    report?: Prisma.InputJsonValue,
  ): Promise<void> {
    const session =
      (await repositoryWrapper.sessionRepository.findByIdWithRelations(
        sessionId,
      )) as SessionWithRelations | null;
    if (!session) {
      throw new apiError("Session not found", 404);
    }

    await repositoryWrapper.sessionRepository.update(sessionId, {
      transcript,
      reportJson: report,
      status: InterviewSessionStatus.COMPLETED,
      checkpointJson: Prisma.DbNull,
    });

    if (report !== undefined) {
      await this.notifyReportReady(session);
    }
  }

  private async notifyReportReady(
    session: SessionWithRelations,
  ): Promise<void> {
    const recruiters = await repositoryWrapper.userRepository.findAll();
    const adminUrl =
      process.env.ADMIN_PUBLIC_URL ??
      `http://localhost:${process.env.ADMIN_PORT ?? 3002}`;
    const sessionUrl = `${adminUrl}/sessions/${session.id}`;
    const candidateName = session.candidate.name ?? session.candidate.email;

    for (const recruiter of recruiters) {
      await enqueueEmail({
        type: "report-ready",
        data: {
          to: recruiter.email,
          candidateName,
          roleName: session.role.name,
          sessionId: session.id,
          sessionUrl,
        },
      });
    }
  }

  private async scheduleAgentStart(
    session: SessionWithRelations,
    meetingUrl: string,
  ): Promise<void> {
    const job: AgentStartJob = {
      sessionId: session.id,
      candidateId: session.candidateId,
      roleId: session.roleId,
      createdById: session.createdById,
      meetingUrl,
      scheduledAt: session.scheduledAt.toISOString(),
    };
    await agentQueue.add("agent-start", job, {
      delay: delayUntil(session.scheduledAt, 2 * MINUTES),
    });
  }

  /** Fires 15 minutes after scheduledAt — apps/api's own orchestratorWorker
   * marks the session NO_SHOW if it never actually started (Phase 8). A
   * negative offset to delayUntil is what pushes the target time past
   * scheduledAt instead of before it. Moved from agentQueue to
   * orchestratorQueue: this is a pure Postgres-status-timing decision, not
   * anything apps/engine needs to be involved in any more. */
  private async scheduleNoShowCheck(
    session: SessionWithRelations,
  ): Promise<void> {
    const job: NoShowCheckJob = { sessionId: session.id };
    await orchestratorQueue.add("noshow-check", job, {
      delay: delayUntil(session.scheduledAt, -15 * MINUTES),
    });
  }

  /** Fires 30 minutes after scheduledAt — must stay in sync with
   * JOIN_WINDOW_MINUTES above and in
   * apps/engine/agent/voice/server.py. A safety net for a
   * session the candidate started but abandoned without deliberately
   * ending the call and never returned to within the resume window (see
   * orchestratorWorker.ts's "interview-timeout-finalize" handler) — a
   * no-op for every other outcome (never started, finished normally,
   * already handled). Moved from agentQueue to orchestratorQueue for the
   * same reason as scheduleNoShowCheck above. */
  private async scheduleInterviewTimeoutFinalize(
    session: SessionWithRelations,
  ): Promise<void> {
    const job: InterviewTimeoutFinalizeJob = { sessionId: session.id };
    await orchestratorQueue.add("interview-timeout-finalize", job, {
      delay: delayUntil(session.scheduledAt, -30 * MINUTES),
    });
  }
}

export default SessionService;
