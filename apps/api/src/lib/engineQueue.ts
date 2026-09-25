import { Queue } from "bullmq";

export const ENGINE_QUEUE_NAME = "engine-jobs";

/** Payload matches packages/shared-schemas/src/engine-job.schema.json —
 * apps/interview-engine (Python, Phase 6) is the consumer, not another
 * TypeScript workspace, so the shape lives there as JSON Schema rather
 * than an importable type. */
export interface EngineStartJob {
  sessionId: number;
  candidateId: number;
  roleId: number;
  meetingUrl: string;
  scheduledAt: string;
}

/** Fires after the interview's scheduled time plus a grace period —
 * apps/interview-engine checks whether the session ever actually started
 * and, if not, marks it NO_SHOW (Phase 8). Distinguished from
 * EngineStartJob on the same queue by BullMQ's own job `name`, exactly
 * like packages/mailer's queue distinguishes its four job types. */
export interface NoShowCheckJob {
  sessionId: number;
}

/** Enqueued the moment a candidate is added (see candidateService.ts's
 * addCandidate), not tied to any particular interview — CV parsing
 * (skills, experience, seniority) doesn't depend on which role a candidate
 * ends up interviewing for, only question *selection* does. Doing this at
 * upload time instead of inside EngineStartJob keeps the slow LLM call out
 * of the 2-minutes-before-the-interview critical path entirely. */
export interface CvParseJob {
  candidateId: number;
}

export type EngineQueueJob = EngineStartJob | NoShowCheckJob | CvParseJob;

export const engineQueue = new Queue<EngineQueueJob>(ENGINE_QUEUE_NAME, {
  connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
