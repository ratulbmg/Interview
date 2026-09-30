import { Candidate, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import prisma from "../lib/db";

class CandidateRepository extends BaseRepository<
  Candidate,
  Prisma.CandidateCreateInput,
  Prisma.CandidateUpdateInput
> {
  constructor() {
    super(prisma.candidate);
  }

  /** Email is only unique per recruiter now (see schema.prisma), not
   * globally — this is the duplicate check candidateService.addCandidate
   * runs, scoped to whichever recruiter is adding the candidate. */
  async findByEmail(email: string, userId: number): Promise<Candidate | null> {
    return prisma.candidate.findFirst({ where: { email, createdById: userId } });
  }

  async findAllOrderedForUser(userId: number): Promise<Candidate[]> {
    return prisma.candidate.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Ownership check for delete — a candidate that exists but belongs to
   * a different recruiter is treated exactly like one that doesn't exist
   * at all (see candidateService.ts). */
  async findByIdForUser(id: number, userId: number): Promise<Candidate | null> {
    return prisma.candidate.findFirst({ where: { id, createdById: userId } });
  }
}

export { CandidateRepository };
