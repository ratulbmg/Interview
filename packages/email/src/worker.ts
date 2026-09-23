import { Worker, Job } from "bullmq";
import { EMAIL_QUEUE_NAME } from "./queue";
import { EmailJob } from "./types";
import { renderEmailJob } from "./templates";
import { sendEmail } from "./mailer";

function connection() {
  return { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
}

async function processEmailJob(job: Job<EmailJob>): Promise<void> {
  const { subject, html } = await renderEmailJob(job.data);
  await sendEmail(job.data.data.to, subject, html);
}

/** concurrency: 1 and a conservative rate limit — this sends real email
 * through an SMTP relay, which is the part of the pipeline actually worth
 * throttling; 3 attempts + exponential backoff (see queue.ts) covers a
 * transient SMTP hiccup without hammering the relay. */
export function startEmailWorker(): Worker<EmailJob> {
  const worker = new Worker<EmailJob>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: connection(),
    concurrency: 1,
    limiter: { max: 10, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.warn(
      `email job ${job.id} (${job.data.type}) sent to ${job.data.data.to}`,
    );
  });
  worker.on("failed", (job, err) => {
    console.error(
      `email job ${job?.id} (${job?.data.type}) failed:`,
      err.message,
    );
  });

  return worker;
}
