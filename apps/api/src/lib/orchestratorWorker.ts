import { Worker, Job } from "bullmq";
import { InterviewSessionStatus } from "../enum";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { sessionService } from "../service";
import { TranscriptTurn, SelectedQuestionDto } from "../model/sessionModel";
import {
  ORCHESTRATOR_QUEUE_NAME,
  OrchestratorQueueJob,
  NoShowCheckJob,
  InterviewTimeoutFinalizeJob,
} from "./orchestratorQueue";

function connection() {
  return { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
}

/** Ports the exact logic of the old apps/engine/agent/db.py's
 * mark_session_no_show_if_not_started: only a session still sitting at
 * SCHEDULED or INVITE_SENT is touched — one that actually started
 * (IN_PROGRESS/COMPLETED) or was already handled some other way
 * (NO_SHOW/CANCELLED) is left alone. */
async function processNoShowCheck(job: NoShowCheckJob): Promise<void> {
  const session = await repositoryWrapper.sessionRepository.findById(
    job.sessionId,
  );
  if (!session) {
    console.warn(`noshow-check: session ${job.sessionId} not found`);
    return;
  }
  if (
    session.status !== InterviewSessionStatus.SCHEDULED &&
    session.status !== InterviewSessionStatus.INVITE_SENT
  ) {
    return;
  }
  await repositoryWrapper.sessionRepository.update(job.sessionId, {
    status: InterviewSessionStatus.NO_SHOW,
  });
}

/** A safety net for a session still IN_PROGRESS at scheduledAt + 30
 * minutes (candidate disconnected without deliberately ending the call,
 * and never came back within the resume window): scores whatever was
 * checkpointed and finalizes it. A no-op if the session already reached a
 * terminal state some other way — including via a candidate's own
 * abandoned join attempt already triggering the same finalize through
 * sessionService.getJoinInstruction. */
async function processInterviewTimeoutFinalize(
  job: InterviewTimeoutFinalizeJob,
): Promise<void> {
  const session =
    await repositoryWrapper.sessionRepository.findByIdWithRelations(
      job.sessionId,
    );
  if (!session) {
    console.warn(
      `interview-timeout-finalize: session ${job.sessionId} not found`,
    );
    return;
  }
  if (session.status !== InterviewSessionStatus.IN_PROGRESS) {
    // Already resolved some other way (finished normally, already
    // finalized by a lazy join attempt, etc.) — nothing to do.
    return;
  }

  const checkpoint = session.checkpointJson as {
    transcript?: TranscriptTurn[];
    selectedQuestions?: SelectedQuestionDto[];
  } | null;
  const transcript = Array.isArray(checkpoint?.transcript)
    ? checkpoint.transcript
    : [];
  const selectedQuestions = Array.isArray(checkpoint?.selectedQuestions)
    ? checkpoint.selectedQuestions
    : [];

  // reportDisconnect with endedDeliberately=true scores (via
  // sessionService's private scoreAndFinalize, using session.role.name
  // internally) and finalizes immediately — exactly the outcome this job
  // needs for a session abandoned past the resume deadline.
  await sessionService.reportDisconnect(
    job.sessionId,
    transcript,
    selectedQuestions,
    true,
  );
}

async function processJob(job: Job<OrchestratorQueueJob>): Promise<void> {
  switch (job.name) {
    case "noshow-check":
      await processNoShowCheck(job.data as NoShowCheckJob);
      return;
    case "interview-timeout-finalize":
      await processInterviewTimeoutFinalize(
        job.data as InterviewTimeoutFinalizeJob,
      );
      return;
    default:
      console.warn(`orchestrator-jobs: unrecognized job name "${job.name}"`);
  }
}

/** apps/api is "the boss" for session-lifecycle timing decisions now, so it
 * consumes its own "orchestrator-jobs" queue in-process rather than
 * handing these off to apps/engine (contrast with
 * packages/mailer's worker, which runs as its own separate process — this
 * one starts inside the same Express process, from index.ts, since there's
 * no separate deployable process for it). */
export function startOrchestratorWorker(): Worker<OrchestratorQueueJob> {
  const worker = new Worker<OrchestratorQueueJob>(
    ORCHESTRATOR_QUEUE_NAME,
    processJob,
    { connection: connection(), concurrency: 5 },
  );

  worker.on("completed", (job) => {
    console.warn(
      `orchestrator job ${job.id} (${job.name}) completed for session ${job.data.sessionId}`,
    );
  });
  worker.on("failed", (job, err) => {
    console.error(
      `orchestrator job ${job?.id} (${job?.name}) failed:`,
      err.message,
    );
  });

  return worker;
}
