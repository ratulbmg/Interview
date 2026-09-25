"""Entrypoint for the persistent voice-serving process: hosts the WebRTC
signaling server the candidate's browser connects to (via Pipecat's own
development runner) and the "engine-jobs" BullMQ consumer, in one process,
so they can share the in-memory ready-room registry (ready_rooms.py).

Run with: python -m engine.voice.server
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

# engine.log_setup has zero pipecat imports of its own, deliberately: even
# importing pipecat's frame dataclasses runs pipecat's package init, which
# configures its own noisy DEBUG-level loguru handler as a side effect. This
# has to be the first import in the file and configure_logging() has to run
# before anything below it, or that handler wins instead.
from engine.log_setup import configure_logging

configure_logging()

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

from engine import db
from engine.config import ENGINE_HOST, ENGINE_PORT, TTS_API_KEY, TTS_BASE_URL, VOICE_TTS_VOICE
from engine.voice import pipeline as pipeline_module
from engine.voice.consumer import start_consumer
from engine.voice.conversation_log import ConversationLogObserver
from engine.voice.ready_rooms import ReadySession, clear as clear_ready_room, get_ready_session
from engine.voice.report import score_interview
from engine.voice.webhook_client import post_transcript

# aioice (WebRTC's underlying ICE layer) drops the peer connection if it
# misses CONSENT_FAILURES consecutive consent-freshness STUN checks
# (RFC 7675), spaced CONSENT_INTERVAL seconds apart — ~30s by default. On
# this local rig, a single native Ollama process generating a reply can
# stall the event loop long enough to miss several of those checks in a
# row, silently killing the call mid-interview. Loosened here for local
# dev, where the LLM is slow and shares the machine with everything else;
# a deployment behind a fast hosted LLM API wouldn't need this.
import aioice.ice

aioice.ice.CONSENT_FAILURES = 24

# How long to wait after a disconnect before treating the interview as
# genuinely over, rather than a dropped connection the candidate is about
# to re-establish (see _run_interview_bot's on_client_disconnected).
RECONNECT_GRACE_SECONDS = 30

# How long after scheduledAt a candidate can still start the interview for
# the first time — see bot()'s expiry check below. Only gates a *fresh*
# join (ReadySession.connection_count == 0); an interview already under
# way is never cut off by wall-clock time. Keep this in sync with the
# meeting-link email's copy (packages/mailer/src/templates/
# MeetingLinkEmail.tsx), which tells the candidate this same number.
JOIN_WINDOW_MINUTES = 30


async def _run_not_ready_bot(transport: BaseTransport) -> None:
    """The candidate opened the room link before their engine-start job
    fired (they can click it any time after the meeting-link email goes
    out, up to a day before the interview — see the scheduler, Phase 5).
    Say so, then end the call."""
    tts = OpenAITTSService(base_url=TTS_BASE_URL, api_key=TTS_API_KEY, settings=OpenAITTSService.Settings(voice=VOICE_TTS_VOICE))
    # transport.input() has to be in the pipeline, even though nothing here
    # ever uses the candidate's speech — the client's "client-ready" signal
    # (what triggers on_client_ready below) arrives as an incoming frame
    # from the transport. Without it, that signal never reaches the RTVI
    # handler, on_client_ready never fires, and the bot just sits there
    # connected and silent until the candidate gives up.
    pipeline = Pipeline([transport.input(), tts, transport.output()])
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


async def _run_expired_bot(transport: BaseTransport, session: ReadySession, room_token: str) -> None:
    """The candidate never joined within JOIN_WINDOW_MINUTES of scheduledAt
    — say so, mark the session NO_SHOW right away (rather than waiting on
    the separate scheduledAt+15min noshow-check job, which may not have
    fired yet if this join attempt lands between the two), free the room,
    then end the call."""
    tts = OpenAITTSService(base_url=TTS_BASE_URL, api_key=TTS_API_KEY, settings=OpenAITTSService.Settings(voice=VOICE_TTS_VOICE))
    # See _run_not_ready_bot's comment — transport.input() is required for
    # the client-ready signal to ever reach on_client_ready below.
    pipeline = Pipeline([transport.input(), tts, transport.output()])
    worker = PipelineWorker(pipeline, params=PipelineParams())
    runner = WorkerRunner()
    await runner.add_workers(worker)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        await worker.queue_frames(
            [
                TTSSpeakFrame("This interview link has expired. Please reach out to your recruiter to reschedule."),
                EndFrame(),
            ]
        )

    await runner.run()
    db.mark_session_no_show_if_not_started(session.session_id)
    clear_ready_room(room_token)


async def _finalize_interview(session: ReadySession, room_token: str) -> None:
    """Scores and posts the transcript, then frees the room. Only called
    once RECONNECT_GRACE_SECONDS has passed with no reconnect — see
    on_client_disconnected below."""
    transcript = session.transcript_so_far
    report = None
    try:
        # score_interview makes blocking OpenAI calls (engine/llm_client.py
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

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True),
        observers=[ConversationLogObserver()],
    )
    runner = WorkerRunner()
    await runner.add_workers(worker)

    session.connection_count += 1
    my_connection_id = session.connection_count

    logger.info(
        f"{'Reconnected to' if is_reconnect else 'Interview starting —'} session {session.session_id} "
        f"({session.candidate_name}, {session.role_name})"
    )

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

    join_deadline = session.scheduled_at + timedelta(minutes=JOIN_WINDOW_MINUTES)
    if session.connection_count == 0 and datetime.now(timezone.utc) > join_deadline:
        logger.warning(f"Session {session.session_id} — join attempt past the {JOIN_WINDOW_MINUTES}-minute window, rejecting")
        await _run_expired_bot(transport, session, room_token)
        return

    await _run_interview_bot(transport, session, room_token)


@app.on_event("startup")
async def _start_engine_jobs_consumer() -> None:
    # Pipecat's own runner.main() resets logging to its own DEBUG-level
    # handler right before this fires (see runner/run.py — `logger.remove()`
    # + `logger.add(sys.stderr, level="DEBUG")` happens synchronously before
    # uvicorn.run()), overriding the module-level configure_logging() call
    # above. Re-applying it here is what actually makes it stick for the
    # server's operating lifetime — everything that matters, since this is
    # the very last thing that runs before the server starts accepting
    # connections.
    configure_logging()
    start_consumer()
    logger.info('engine: "engine-jobs" BullMQ consumer started')


if __name__ == "__main__":
    sys.argv += ["--host", ENGINE_HOST, "--port", str(ENGINE_PORT), "-t", "webrtc"]
    main()
