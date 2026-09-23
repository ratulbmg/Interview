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
}

export { SessionRepository };
