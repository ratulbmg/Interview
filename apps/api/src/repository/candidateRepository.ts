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

  async findByEmail(email: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({ where: { email } });
  }

  async findAllOrdered(): Promise<Candidate[]> {
    return prisma.candidate.findMany({ orderBy: { createdAt: "desc" } });
  }
}

export { CandidateRepository };
