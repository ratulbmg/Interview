import { Queue } from "bullmq";

export const AGENT_QUEUE_NAME = "agent-jobs";

/** Payload matches packages/shared-schemas/src/agent-job.schema.json —
 * apps/interview-agent (Python, Phase 6) is the consumer, not another
 * TypeScript workspace, so the shape lives there as JSON Schema rather
 * than an importable type. */
export interface AgentStartJob {
  sessionId: number;
  candidateId: number;
  roleId: number;
  meetingUrl: string;
  scheduledAt: string;
}

export const agentQueue = new Queue<AgentStartJob>(AGENT_QUEUE_NAME, {
  connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
