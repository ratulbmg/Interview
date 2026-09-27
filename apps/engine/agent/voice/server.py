"""Entrypoint for the persistent voice-serving process: hosts the WebRTC
signaling server the candidate's browser connects to (via Pipecat's own
development runner) and the "agent-jobs" BullMQ consumer, in one process.

apps/api is "the orchestrator" for every session-lifecycle decision now (is this
candidate too early, has the link expired, is this a fresh start or a
resume, what exactly should the bot say) — this process is a pure executor:
on every connection it asks the API what to do for the room token
(agent/orchestrator_client.py's join()) and acts purely on the instruction it gets
back, dispatching into agent/conversation/manager.py. It also reports
events back to the API (consent given, disconnected) instead of deciding
anything itself. The only thing still decided here is scoring a finished
interview (see the /score route mounted below, agent/api/routes.py, and
agent/interview/evaluator.py) — that needs an LLM call only this process
can make.

Run with: python -m agent.voice.server
"""

import sys

# agent.log_setup has zero pipecat imports of its own, deliberately: even
# importing pipecat's frame dataclasses runs pipecat's package init, which
# configures its own noisy DEBUG-level loguru handler as a side effect. This
# has to be the first import in the file and configure_logging() has to run
# before anything below it, or that handler wins instead.
from agent.log_setup import configure_logging

configure_logging()

from loguru import logger
from pipecat.runner.run import app, main
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import TransportParams

from agent import orchestrator_client
from agent.api.routes import router
from agent.api.schemas import selected_questions_from_dtos
from agent.config import AGENT_HOST, AGENT_PORT
from agent.conversation.manager import _run_interview_bot, _speak_and_end
from agent.jobs.consumer import start_consumer

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

app.include_router(router)


async def bot(runner_args: RunnerArguments) -> None:
    room_token = (runner_args.body or {}).get("roomToken") if isinstance(runner_args.body, dict) else None
    transport = await create_transport(runner_args, {"webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True)})

    if not room_token:
        await _speak_and_end(transport, "Your interview hasn't started yet. Please come back at your scheduled time.")
        return

    try:
        instruction = await orchestrator_client.join(room_token)
    except Exception as error:
        logger.error(f"Failed to get join instruction for room {room_token!r}: {error}")
        await _speak_and_end(transport, "Something went wrong. Please try again shortly.")
        return

    action = instruction.get("action")
    if action == "speak_and_end":
        await _speak_and_end(transport, instruction["message"])
    elif action in ("start", "resume"):
        selected_questions = selected_questions_from_dtos(instruction["selectedQuestions"])
        prior_transcript = instruction.get("priorTranscript") if action == "resume" else None
        await _run_interview_bot(
            transport,
            room_token,
            instruction["sessionId"],
            instruction["candidateName"],
            instruction["roleName"],
            selected_questions,
            prior_transcript=prior_transcript,
        )
    else:
        logger.error(f"Unknown join instruction action: {action!r}")
        await _speak_and_end(transport, "Something went wrong. Please try again shortly.")


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
    logger.info('agent: "agent-jobs" BullMQ consumer started')


if __name__ == "__main__":
    sys.argv += ["--host", AGENT_HOST, "--port", str(AGENT_PORT), "-t", "webrtc"]
    main()
