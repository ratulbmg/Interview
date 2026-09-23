import "dotenv/config";
import { startEmailWorker } from "@repo/email";

const worker = startEmailWorker();
console.warn(
  `email-worker: listening on the "email" queue (${process.env.REDIS_URL ?? "redis://localhost:6379"})`,
);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
