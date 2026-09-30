import { InterviewSession, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import { InterviewSessionStatus } from "../enum";
import prisma from "../lib/db";

const withCandidateAndRole = { candidate: true, role: true } as const;

class SessionRepository extends BaseRepository<
  InterviewSession,
  Prisma.InterviewSessionCreateInput,
  Prisma.InterviewSessionUpdateInput
> {
  constructor() {
    super(prisma.interviewSession);
  }

  // findAllWithRelations / findByIdWithRelations / findCompletedWithReports
  // below are deliberately NOT scoped by recruiter — every one of their
  // callers is either candidate-facing (the join flow, keyed by room
  // token) or an internal webhook/job handler (consent, disconnect,
  // finalize) that has no authenticated recruiter request to scope by at
  // all. The *ForUser variants further down are the ones an actual
  // recruiter-authenticated route uses.

  async findAllWithRelations(): Promise<InterviewSession[]> {
    return prisma.interviewSession.findMany({
      orderBy: { scheduledAt: "desc" },
      include: withCandidateAndRole,
    });
  }

  async findByIdWithRelations(id: number): Promise<InterviewSession | null> {
    return prisma.interviewSession.findUnique({
      where: { id },
      include: withCandidateAndRole,
    });
  }

  /** Only sessions that actually have a scored report — used by the
   * Results screen (see sessionService.listResults), which has nothing
   * meaningful to show for a session that hasn't been scored yet. */
  async findCompletedWithReports(): Promise<InterviewSession[]> {
    return prisma.interviewSession.findMany({
      where: {
        status: InterviewSessionStatus.COMPLETED,
        reportJson: { not: Prisma.JsonNull },
      },
      orderBy: { scheduledAt: "desc" },
      include: withCandidateAndRole,
    });
  }

  /** Recruiter-scoped list — see sessionService.listSessions. */
  async findAllForUser(userId: number): Promise<InterviewSession[]> {
    return prisma.interviewSession.findMany({
      where: { createdById: userId },
      orderBy: { scheduledAt: "desc" },
      include: withCandidateAndRole,
    });
  }

  /** Recruiter-scoped version of findCompletedWithReports — see
   * sessionService.listResults. */
  async findCompletedWithReportsForUser(
    userId: number,
  ): Promise<InterviewSession[]> {
    return prisma.interviewSession.findMany({
      where: {
        createdById: userId,
        status: InterviewSessionStatus.COMPLETED,
        reportJson: { not: Prisma.JsonNull },
      },
      orderBy: { scheduledAt: "desc" },
      include: withCandidateAndRole,
    });
  }

  /** Ownership check for getSession/deleteSession/sendInvite — a session
   * that exists but was scheduled by another recruiter is treated exactly
   * like one that doesn't exist. */
  async findByIdForUser(
    id: number,
    userId: number,
  ): Promise<InterviewSession | null> {
    return prisma.interviewSession.findFirst({
      where: { id, createdById: userId },
      include: withCandidateAndRole,
    });
  }

  /** The room token a candidate's browser sends is just the trailing UUID
   * segment of meetingUrl (minted once in meetingProvider.ts) — there's no
   * separate column for it, so match on that suffix instead. Used by
   * sessionService.getJoinInstruction, the API's replacement for
   * apps/engine's old db.get_session_by_room_token. */
  async findByRoomToken(roomToken: string): Promise<InterviewSession | null> {
    return prisma.interviewSession.findFirst({
      where: { meetingUrl: { endsWith: `/${roomToken}` } },
      include: withCandidateAndRole,
    });
  }

  /** Adds this connection segment's usage to whatever the session already
   * has — never overwrites, since a drop-and-resume reports again for the
   * same session (see sessionService.reportDisconnect). Called on every
   * disconnect, regardless of whether it turns out to be a deliberate end
   * or a checkpoint-and-resume. */
  async incrementUsage(id: number, usage: SessionUsageIncrement): Promise<void> {
    await prisma.interviewSession.update({
      where: { id },
      data: {
        llmPromptTokensUsed: { increment: usage.llmPromptTokens },
        llmCompletionTokensUsed: { increment: usage.llmCompletionTokens },
        sttAudioSecondsUsed: { increment: usage.sttAudioSeconds },
        ttsCharactersUsed: { increment: usage.ttsCharacters },
        interviewSecondsUsed: { increment: usage.interviewSeconds },
      },
    });
  }

  /** Sums real usage across every session that actually ran at least one
   * live turn (interviewSecondsUsed > 0) for this recruiter — a session
   * that's merely scheduled or never connected contributes nothing here.
   * Backs the AI Usage page's real totals (see usage/usageService.ts). */
  async aggregateUsageForUser(userId: number): Promise<SessionUsageTotals> {
    const [totals, count] = await Promise.all([
      prisma.interviewSession.aggregate({
        where: { createdById: userId, interviewSecondsUsed: { gt: 0 } },
        _sum: {
          llmPromptTokensUsed: true,
          llmCompletionTokensUsed: true,
          sttAudioSecondsUsed: true,
          ttsCharactersUsed: true,
          interviewSecondsUsed: true,
        },
      }),
      prisma.interviewSession.count({
        where: { createdById: userId, interviewSecondsUsed: { gt: 0 } },
      }),
    ]);

    return {
      totalInterviews: count,
      llmPromptTokens: totals._sum.llmPromptTokensUsed ?? 0,
      llmCompletionTokens: totals._sum.llmCompletionTokensUsed ?? 0,
      sttAudioSeconds: totals._sum.sttAudioSecondsUsed ?? 0,
      ttsCharacters: totals._sum.ttsCharactersUsed ?? 0,
      interviewSeconds: totals._sum.interviewSecondsUsed ?? 0,
    };
  }
}

export interface SessionUsageIncrement {
  llmPromptTokens: number;
  llmCompletionTokens: number;
  sttAudioSeconds: number;
  ttsCharacters: number;
  interviewSeconds: number;
}

export interface SessionUsageTotals {
  totalInterviews: number;
  llmPromptTokens: number;
  llmCompletionTokens: number;
  sttAudioSeconds: number;
  ttsCharacters: number;
  interviewSeconds: number;
}

export { SessionRepository };
