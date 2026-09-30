import { Queue } from "bullmq";

export const AGENT_QUEUE_NAME = "agent-jobs";

/** Payload matches packages/shared-schemas/src/agent-job.schema.json —
 * apps/engine (Python, Phase 6) is the consumer, not another
 * TypeScript workspace, so the shape lives there as JSON Schema rather
 * than an importable type. */
export interface AgentStartJob {
  sessionId: number;
  candidateId: number;
  roleId: number;
  /** The recruiter who scheduled this session — apps/engine selects this
   * session's questions only from this recruiter's own question bank (see
   * packages/db/prisma/schema.prisma's Question.createdBy). */
  createdById: number;
  meetingUrl: string;
  scheduledAt: string;
}

/** Enqueued the moment a candidate is added (see candidateService.ts's
 * addCandidate), not tied to any particular interview — CV parsing
 * (skills, experience, seniority) doesn't depend on which role a candidate
 * ends up interviewing for, only question *selection* does. Doing this at
 * upload time instead of inside AgentStartJob keeps the slow LLM call out
 * of the 2-minutes-before-the-interview critical path entirely. */
export interface CvParseJob {
  candidateId: number;
}

/** apps/engine (Python) is the sole consumer of this queue now —
 * it prepares interview content (CV parsing, question selection), which
 * legitimately needs its embeddings/LLM access. Session-lifecycle timing
 * decisions (no-show, timeout finalize) moved to apps/api's own
 * "orchestrator-jobs" queue — see orchestratorQueue.ts — since apps/api is
 * now "the boss" for all session state decisions. */
export type AgentQueueJob = AgentStartJob | CvParseJob;

export const agentQueue = new Queue<AgentQueueJob>(AGENT_QUEUE_NAME, {
  connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
