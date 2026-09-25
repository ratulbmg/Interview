import "dotenv/config";
import { startMailer } from "./worker";

const worker = startMailer();
console.warn(
  `mailer: listening on the "email" queue (${process.env.REDIS_URL ?? "redis://localhost:6379"})`,
);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
