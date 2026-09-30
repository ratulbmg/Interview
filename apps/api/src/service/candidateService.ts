import { randomUUID } from "crypto";
import { Candidate } from "@repo/db/client";
import { apiError } from "../utils/apiError";
import { AddCandidateRequest } from "../model/candidateModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { agentQueue } from "../lib/agentQueue";

class CandidateService {
  /** Each recruiter only ever sees candidates they added — there's no
   * shared, cross-recruiter list (see packages/db/prisma/schema.prisma's
   * Candidate.createdBy). */
  async listCandidates(userId: number): Promise<Candidate[]> {
    return repositoryWrapper.candidateRepository.findAllOrderedForUser(userId);
  }

  /**
   * Adding a candidate is deliberately just email + optional name + a CV
   * file — no age, no role (role and scheduling only exist on
   * InterviewSession, a separate recruiter action — see sessionService).
   *
   * `cvParsedJson` is left null here and filled in asynchronously: this
   * call returns as soon as the row is saved, never waiting on
   * apps/engine's CV-parsing LLM call (a `cv-parse` job is
   * enqueued right after, so adding many candidates back-to-back stays
   * instant regardless of how long parsing takes — see agent/voice/
   * consumer.py's _process_cv_parse_job).
   */
  async addCandidate(
    data: AddCandidateRequest,
    cvFile: Express.Multer.File,
    userId: number,
  ): Promise<Candidate> {
    const existing = await repositoryWrapper.candidateRepository.findByEmail(
      data.email,
      userId,
    );
    if (existing) {
      throw new apiError(
        "You already have a candidate with this email address",
        409,
      );
    }

    const publicUrl =
      process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT}`;
    const cvUrl = `${publicUrl}/uploads/${cvFile.filename}`;

    const candidate = await repositoryWrapper.candidateRepository.create({
      uniqueId: randomUUID(),
      email: data.email,
      name: data.name?.trim() || null,
      cvUrl,
      createdBy: { connect: { id: userId } },
    });

    await agentQueue.add("cv-parse", { candidateId: candidate.id });

    return candidate;
  }

  /** Cascades to that candidate's sessions at the database level (see
   * packages/db/prisma/schema.prisma's onDelete: Cascade on
   * InterviewSession.candidate) — not handled here in application code, so
   * it holds regardless of which process deletes the row. A candidate that
   * exists but belongs to another recruiter is treated identically to one
   * that doesn't exist. */
  async deleteCandidate(id: number, userId: number): Promise<void> {
    const existing = await repositoryWrapper.candidateRepository.findByIdForUser(
      id,
      userId,
    );
    if (!existing) {
      throw new apiError("Candidate not found", 404);
    }
    await repositoryWrapper.candidateRepository.delete(id);
  }
}

export default CandidateService;
