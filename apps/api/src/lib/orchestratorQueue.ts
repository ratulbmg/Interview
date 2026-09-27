import { Queue } from "bullmq";

export const ORCHESTRATOR_QUEUE_NAME = "orchestrator-jobs";

/** Payload matches packages/shared-schemas/src/orchestrator-job.schema.json.
 * Unlike agent-jobs, apps/api is both producer AND consumer of this queue
 * (see orchestratorWorker.ts) — these are pure Postgres-status-timing
 * decisions ("is this session still where it should be"), not anything
 * that needs the Python agent's LLM/embeddings access, so there's no
 * reason to cross the process boundary for them any more. */

/** Fires 15 minutes after scheduledAt — marks the session NO_SHOW if it
 * never actually started (see orchestratorWorker.ts's "noshow-check"
 * handler). A no-op if the session already started or resolved some other
 * way. */
export interface NoShowCheckJob {
  sessionId: number;
}

/** Fires at scheduledAt + 30 minutes — must stay in sync with
 * JOIN_WINDOW_MINUTES in apps/engine/agent/voice/server.py. A
 * safety net for a session still IN_PROGRESS at that point (candidate
 * disconnected without deliberately ending the call, and never came back
 * within the resume window): scores whatever was checkpointed and
 * finalizes it. A no-op if the session already reached a terminal state
 * some other way. */
export interface InterviewTimeoutFinalizeJob {
  sessionId: number;
}

export type OrchestratorQueueJob = NoShowCheckJob | InterviewTimeoutFinalizeJob;

export const orchestratorQueue = new Queue<OrchestratorQueueJob>(
  ORCHESTRATOR_QUEUE_NAME,
  {
    connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  },
);
