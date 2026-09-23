import { InterviewSession, Candidate, Role, Prisma } from "@repo/db/client";
import { enqueueEmail } from "@repo/email";
import { InterviewSessionStatus } from "../enum";
import { apiError } from "../utils/apiError";
import { ScheduleSessionRequest } from "../model/sessionModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { meetingProvider } from "../lib/meetingProvider";
import { agentQueue, AgentStartJob } from "../lib/agentQueue";
import { delayUntil, MINUTES, DAYS } from "../lib/scheduling";

type SessionWithRelations = InterviewSession & {
  candidate: Candidate;
  role: Role;
};

class SessionService {
  async listSessions(): Promise<InterviewSession[]> {
    return repositoryWrapper.sessionRepository.findAllWithRelations();
  }

  async getSession(id: number): Promise<InterviewSession> {
    const session =
      await repositoryWrapper.sessionRepository.findByIdWithRelations(id);
    if (!session) {
      throw new apiError("Session not found", 404);
    }
    return session;
  }

  /** Scheduling is a second, separate action from adding the candidate —
   * this only creates the session record; nothing is sent to the candidate
   * until sendInvite() below is called. */
  async scheduleSession(
    data: ScheduleSessionRequest,
  ): Promise<InterviewSession> {
    const candidate = await repositoryWrapper.candidateRepository.findById(
      data.candidateId,
    );
    if (!candidate) {
      throw new apiError("Candidate not found", 404);
    }

    const role = await repositoryWrapper.roleRepository.findById(data.roleId);
    if (!role) {
      throw new apiError("Role not found", 404);
    }

    return repositoryWrapper.sessionRepository.create({
      candidate: { connect: { id: candidate.id } },
      role: { connect: { id: role.id } },
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
  async sendInvite(id: number): Promise<InterviewSession> {
    const session =
      (await repositoryWrapper.sessionRepository.findByIdWithRelations(
        id,
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
   * apps/interview-agent posts here once the candidate hangs up or the
   * interview otherwise ends (see agent/voice/webhook_client.py), with the
   * transcript and — since the agent already scored the interview itself
   * right after it ended — the report. Stores both, marks the session
   * COMPLETED, and enqueues a report-ready email to every recruiter; none
   * of that needs a recruiter action to trigger.
   */
  async receiveTranscript(
    id: number,
    transcript: Prisma.InputJsonValue,
    report?: Prisma.InputJsonValue,
  ): Promise<InterviewSession> {
    const session =
      (await repositoryWrapper.sessionRepository.findByIdWithRelations(
        id,
      )) as SessionWithRelations | null;
    if (!session) {
      throw new apiError("Session not found", 404);
    }

    const updated = await repositoryWrapper.sessionRepository.update(id, {
      transcript,
      reportJson: report,
      status: InterviewSessionStatus.COMPLETED,
    });

    if (report !== undefined) {
      await this.notifyReportReady(session);
    }

    return updated;
  }

  private async notifyReportReady(
    session: SessionWithRelations,
  ): Promise<void> {
    const recruiters = await repositoryWrapper.userRepository.findAll();
    const dashboardUrl =
      process.env.DASHBOARD_PUBLIC_URL ??
      `http://localhost:${process.env.DASHBOARD_PORT ?? 3002}`;
    const sessionUrl = `${dashboardUrl}/sessions/${session.id}`;
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
      meetingUrl,
      scheduledAt: session.scheduledAt.toISOString(),
    };
    await agentQueue.add("agent-start", job, {
      delay: delayUntil(session.scheduledAt, 2 * MINUTES),
    });
  }
}

export default SessionService;
