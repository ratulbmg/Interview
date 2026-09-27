import { InterviewSession, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
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
}

export { SessionRepository };
