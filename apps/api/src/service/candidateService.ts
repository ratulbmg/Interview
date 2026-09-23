import { randomUUID } from "crypto";
import { Candidate } from "@repo/db/client";
import { apiError } from "../utils/apiError";
import { AddCandidateRequest } from "../model/candidateModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";

class CandidateService {
  async listCandidates(): Promise<Candidate[]> {
    return repositoryWrapper.candidateRepository.findAllOrdered();
  }

  /**
   * Adding a candidate is deliberately just email + optional name + a CV
   * file — no age, no role (role and scheduling only exist on
   * InterviewSession, a separate recruiter action — see sessionService).
   *
   * `cvParsedJson` is left null here: parsing the CV into structured JSON
   * is apps/interview-agent's job (see cv_parser.py, Phase 2), which isn't
   * wired into this HTTP path yet.
   */
  async addCandidate(
    data: AddCandidateRequest,
    cvFile: Express.Multer.File,
  ): Promise<Candidate> {
    const existing = await repositoryWrapper.candidateRepository.findByEmail(
      data.email,
    );
    if (existing) {
      throw new apiError("A candidate with this email already exists", 409);
    }

    const publicUrl =
      process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT}`;
    const cvUrl = `${publicUrl}/uploads/${cvFile.filename}`;

    return repositoryWrapper.candidateRepository.create({
      uniqueId: randomUUID(),
      email: data.email,
      name: data.name?.trim() || null,
      cvUrl,
    });
  }
}

export default CandidateService;
