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
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner

from agent.config import AGENT_HOST, AGENT_PORT, OPENAI_API_KEY, OPENAI_VOICE_ID
from agent.voice import pipeline as pipeline_module
from agent.voice.consumer import start_consumer
from agent.voice.ready_rooms import get_ready_session
from agent.voice.report import score_interview
from agent.voice.webhook_client import post_transcript


async def _run_not_ready_bot(transport: BaseTransport) -> None:
    """The candidate opened the room link before their agent-start job
    fired (they can click it any time after the meeting-link email goes
    out, up to a day before the interview — see the scheduler, Phase 5).
    Say so, then end the call."""
    tts = OpenAITTSService(api_key=OPENAI_API_KEY, settings=OpenAITTSService.Settings(voice=OPENAI_VOICE_ID))
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


async def _run_interview_bot(transport: BaseTransport, session) -> None:
    pipeline, context = pipeline_module.build_pipeline(transport, session)

    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True))
    runner = WorkerRunner()
    await runner.add_workers(worker)

    from agent import db

    db.mark_session_in_progress(session.session_id)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        context.add_message({"role": "developer", "content": "Greet the candidate by name and ask the first question."})
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Candidate disconnected — session {session.session_id}")
        transcript = pipeline_module.extract_transcript(context)
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
        await runner.cancel()

    await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    room_token = (runner_args.body or {}).get("roomToken") if isinstance(runner_args.body, dict) else None
    session = get_ready_session(room_token) if room_token else None

    transport = await create_transport(runner_args, {"webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True)})

    if session is None:
        logger.warning(f"No ready session for room token {room_token!r}")
        await _run_not_ready_bot(transport)
        return

    await _run_interview_bot(transport, session)


@app.on_event("startup")
async def _start_agent_jobs_consumer() -> None:
    start_consumer()
    logger.info('agent: "agent-jobs" BullMQ consumer started')


if __name__ == "__main__":
    sys.argv += ["--host", AGENT_HOST, "--port", str(AGENT_PORT), "-t", "webrtc"]
    main()
