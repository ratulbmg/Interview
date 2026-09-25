import { Queue } from "bullmq";
import { EmailJob } from "./types";

export const EMAIL_QUEUE_NAME = "email";

function connection() {
  return { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
}

export const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
  connection: connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    // Jobs pile up as delayed (see client.ts's `delay` option, used by the
    // scheduler in Phase 5) — clean up after they finish so Redis doesn't
    // accumulate every email ever sent.
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
