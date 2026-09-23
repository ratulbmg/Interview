import { emailQueue } from "./queue";
import { EmailJob } from "./types";

export interface EnqueueEmailOptions {
  /** Milliseconds to delay before the job becomes available to the worker
   * — how the scheduler (Phase 5) places the follow-up and meeting-link
   * emails at the right time relative to scheduledAt without three
   * separate recruiter actions. Omit (or 0) to send as soon as possible. */
  delay?: number;
}

export async function enqueueEmail(
  job: EmailJob,
  opts?: EnqueueEmailOptions,
): Promise<string> {
  const enqueued = await emailQueue.add(job.type, job, { delay: opts?.delay });
  return enqueued.id ?? "";
}
