import app from "./app";
import { startOrchestratorWorker } from "./lib/orchestratorWorker";

app.listen(process.env.API_PORT, () => {
  console.log(
    `API server started => http://localhost:${process.env.API_PORT}/`,
  );
});

// Runs in-process for the life of this same server — apps/api is "the
// boss" for session-lifecycle timing decisions (no-show, interview
// timeout finalize) now, so there's no separate deployable consumer
// process for these the way packages/mailer has one for email.
const orchestratorWorker = startOrchestratorWorker();
console.warn('orchestrator: listening on the "orchestrator-jobs" queue');

process.on("SIGTERM", async () => {
  await orchestratorWorker.close();
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});
