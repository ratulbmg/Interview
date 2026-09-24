"""Entrypoint for the persistent voice-serving process: hosts the WebRTC
signaling server the candidate's browser connects to (via Pipecat's own
development runner) and the "agent-jobs" BullMQ consumer, in one process,
so they can share the in-memory ready-room registry (ready_rooms.py).

Run with: python -m agent.voice.server
"""

import asyncio
import sys

from loguru import logger
from pipecat.frames.frames import EndFrame, LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.runner.run import app, main
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner

from agent import db
from agent.config import AGENT_HOST, AGENT_PORT, VOICE_TTS_VOICE
from agent.voice import pipeline as pipeline_module
from agent.voice.consumer import start_consumer
from agent.voice.ready_rooms import ReadySession, clear as clear_ready_room, get_ready_session
from agent.voice.report import score_interview
from agent.voice.webhook_client import post_transcript

# How long to wait after a disconnect before treating the interview as
# genuinely over, rather than a dropped connection the candidate is about
# to re-establish (see _run_interview_bot's on_client_disconnected).
RECONNECT_GRACE_SECONDS = 30


async def _run_not_ready_bot(transport: BaseTransport) -> None:
    """The candidate opened the room link before their agent-start job
    fired (they can click it any time after the meeting-link email goes
    out, up to a day before the interview — see the scheduler, Phase 5).
    Say so, then end the call."""
    tts = KokoroTTSService(settings=KokoroTTSService.Settings(voice=VOICE_TTS_VOICE))
    pipeline = Pipeline([tts, transport.output()])
    worker = PipelineWorker(pipeline, params=PipelineParams())
    runner = WorkerRunner()
    await runner.add_workers(worker)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        await worker.queue_frames(
            [
                TTSSpeakFrame("Your interview hasn't started yet. Please come back at your scheduled time — you'll be able to join a couple of minutes early."),
                EndFrame(),
            ]
        )

    await runner.run()


async def _finalize_interview(session: ReadySession, room_token: str) -> None:
    """Scores and posts the transcript, then frees the room. Only called
    once RECONNECT_GRACE_SECONDS has passed with no reconnect — see
    on_client_disconnected below."""
    transcript = session.transcript_so_far
    report = None
    try:
        # score_interview makes blocking OpenAI calls (agent/llm_client.py
        # uses the sync client) — offload so it doesn't stall this
        # process's event loop (and every other connection it's serving).
        report = await asyncio.to_thread(score_interview, transcript, session.selected_questions, session.role_name)
    except Exception as error:
        logger.error(f"Failed to score session {session.session_id}: {error}")
    try:
        await post_transcript(session.session_id, transcript, report)
    except Exception as error:
        logger.error(f"Failed to post transcript for session {session.session_id}: {error}")
    clear_ready_room(room_token)


async def _run_interview_bot(transport: BaseTransport, session: ReadySession, room_token: str) -> None:
    is_reconnect = len(session.transcript_so_far) > 0
    pipeline, context = pipeline_module.build_pipeline(transport, session, resume_messages=session.transcript_so_far)

    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True))
    runner = WorkerRunner()
    await runner.add_workers(worker)

    session.connection_count += 1
    my_connection_id = session.connection_count

    if not is_reconnect:
        db.mark_session_in_progress(session.session_id)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        if not session.consent_logged:
            # The system prompt (pipeline.py) makes the recording/AI-evaluation
            # notice the first thing the bot says — logged here, once, right as
            # that flow kicks off.
            db.log_consent(session.session_id)
            session.consent_logged = True

        # "developer"-role messages are silently dropped by Ollama's chat API
        # (see OLLamaLLMService.supports_developer_role in pipecat) — "user"
        # is what actually reaches the model there.
        if is_reconnect:
            context.add_message({"role": "user", "content": "[The candidate just reconnected after a brief interruption. Briefly acknowledge that and continue the interview from where it left off — don't restart or re-ask what's already been covered.]"})
        else:
            context.add_message({"role": "user", "content": "[Begin the interview now: start with the recording/AI-evaluation notice, then greet the candidate by name and ask the first question.]"})
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Candidate disconnected — session {session.session_id} (connection {my_connection_id})")
        session.transcript_so_far = pipeline_module.extract_transcript(context)
        await runner.cancel()

        await asyncio.sleep(RECONNECT_GRACE_SECONDS)
        if session.connection_count != my_connection_id:
            # A newer connection has already taken over — that connection's
            # own disconnect handler is responsible for finalizing.
            logger.info(f"Session {session.session_id} reconnected during grace period — not finalizing")
            return
        await _finalize_interview(session, room_token)

    await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    room_token = (runner_args.body or {}).get("roomToken") if isinstance(runner_args.body, dict) else None
    session = get_ready_session(room_token) if room_token else None

    transport = await create_transport(runner_args, {"webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True)})

    if session is None:
        logger.warning(f"No ready session for room token {room_token!r}")
        await _run_not_ready_bot(transport)
        return

    await _run_interview_bot(transport, session, room_token)


@app.on_event("startup")
async def _start_agent_jobs_consumer() -> None:
    start_consumer()
    logger.info('agent: "agent-jobs" BullMQ consumer started')


if __name__ == "__main__":
    sys.argv += ["--host", AGENT_HOST, "--port", str(AGENT_PORT), "-t", "webrtc"]
    main()
