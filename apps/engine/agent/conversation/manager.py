"""Builds the STT -> LLM -> TTS pipeline for one candidate's interview and
runs it for the lifetime of a WebRTC connection.

Question-by-question progression is driven turn-by-turn now, not left
entirely to the LLM's own judgment: agent/interview/adaptive_questioning.py's
AdaptiveQuestioningProcessor — built and inserted into the pipeline here,
since wiring it into the live frame stream is a pipeline-construction
concern, even though the processor itself is interview-domain logic — sits
between the user context aggregator and the LLM, and after each candidate
answer, runs agent/interview/answer_analyzer.py + agent/interview/
followup_policy.py to decide — deterministically, with hard
maxFollowups/maxDurationSeconds limits — whether to inject a targeted
follow-up directive or move on to the next selected question. The LLM still
owns all conversational judgment *within* whichever directive it's given
(how exactly to phrase a question, how to react to what the candidate
says); it just no longer decides *when* to stop probing a topic or which
question comes next.

STT and TTS talk to self-hosted Docker containers (speaches, kokoro-fastapi
— see docker-compose.yml) over their own OpenAI-compatible endpoints, via
agent/stt/client.py and agent/tts/client.py.

apps/api is "the orchestrator" for every session-lifecycle decision (is this
candidate too early, has the link expired, is this a fresh start or a
resume, what exactly should the bot say) — agent/voice/server.py's bot()
asks it what to do and dispatches into the functions here, which are pure
executors: they run the pipeline / speak a message and report back what
happened (consent given, disconnected) via agent/orchestrator_client.py.
"""

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import EndFrame, LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import BaseTransport
from pipecat.workers.runner import WorkerRunner

from agent import orchestrator_client
from agent.config import LLM_API_KEY, LLM_BASE_URL, VOICE_LLM_MODEL
from agent.conversation.logging import ConversationLogObserver
from agent.conversation.prosody import ProsodyPacingProcessor
from agent.conversation.state import extract_transcript
from agent.conversation.turn_manager import load_turn_timing_config
from agent.conversation.usage_tracking import UsageTracker
from agent.interview.adaptive_questioning import AdaptiveQuestioningProcessor
from agent.interview.prompt import END_INTERVIEW_FUNCTION_NAME, END_INTERVIEW_TOOL, _build_system_instruction
from agent.interview.questions import SelectedQuestion
from agent.scoring.serializers import dtos_from_selected_questions
from agent.stt.client import build_stt_service
from agent.tts.client import build_tts_service
from agent.voice.ready_rooms import bump as bump_connection, is_current as is_current_connection


def build_pipeline(
    transport: BaseTransport,
    candidate_name: str,
    role_name: str,
    selected_questions: list[SelectedQuestion],
    resume_messages: list[dict] | None = None,
) -> tuple[Pipeline, LLMContext, OpenAILLMService, AdaptiveQuestioningProcessor]:
    """`resume_messages` seeds the context for a "resume" join instruction
    (apps/api's /agent/rooms/join hands back the prior transcript — see
    agent/voice/server.py's bot()/_run_interview_bot below) so the LLM
    picks the conversation back up instead of starting over. Also tells
    AdaptiveQuestioningProcessor below whether to treat this connection's
    first user turn as the candidate's consent confirmation (fresh start)
    or a genuine continuation (resume, since consent already happened on
    the earlier connection).

    STT and TTS each talk to their own self-hosted, OpenAI-compatible
    Docker container (see agent/stt/client.py, agent/tts/client.py, and
    docker-compose.yml), same as the LLM talks to Ollama over LLM_BASE_URL.
    Plain OpenAILLMService rather than pipecat's OLLamaLLMService wrapper:
    that wrapper hardcodes Ollama's dummy API key internally and has no way
    to override it, which breaks any OpenAI-compatible server that actually
    enforces one (LM Studio's does)."""
    is_resume = bool(resume_messages)

    stt = build_stt_service()

    tts = build_tts_service()

    llm = OpenAILLMService(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        settings=OpenAILLMService.Settings(
            model=VOICE_LLM_MODEL,
            system_instruction=_build_system_instruction(candidate_name, role_name),
        ),
    )

    timing = load_turn_timing_config()

    # END_INTERVIEW_TOOL is advertise-only here (no handler attached) — the
    # actual handler is registered by _run_interview_bot below, once it has
    # a PipelineWorker to speak the closing line and hang up through. The
    # LLM decides *whether* to call it, same as it decides everything else
    # about conversation content (see agent/interview/prompt.py); this
    # module just wires the mechanism up.
    context = LLMContext(messages=resume_messages or None, tools=[END_INTERVIEW_TOOL])
    # SileroVADAnalyzer on the user aggregator is what gives this pipeline
    # both turn detection (knowing when the candidate has finished
    # speaking) and barge-in (new user speech interrupts the bot's TTS
    # mid-sentence) — both are default pipeline behavior once VAD is wired
    # in, not something built by hand here. ENABLE_BARGE_IN gates this for
    # real: omitting vad_analyzer (its documented default is None) actually
    # removes turn detection/barge-in, it isn't a cosmetic flag.
    # Default stop_secs (0.2s) decides the candidate is done talking after a
    # very short pause, splitting normal mid-sentence pauses into separate
    # turns and making the bot interrupt/re-ask instead of waiting for a full
    # answer — bump it so it waits for a more natural conversational gap.
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.8)) if timing.enable_barge_in else None
        ),
    )

    # Inserts a short, configurable pause between the bot's spoken sentences
    # (longer right after a brief acknowledgement) — see
    # agent/conversation/prosody.py for why it sits here, between the LLM
    # and TTS, and why it can't and doesn't interfere with barge-in. A
    # pass-through no-op when ENABLE_INTERVIEW_PROSODY is false.
    prosody = ProsodyPacingProcessor(timing)

    # Sits between the user aggregator and the LLM: after each candidate
    # answer, decides (deterministically — see followup_policy.py) whether
    # to inject a targeted follow-up directive or move on to the next
    # selected question, before the LLM ever sees the turn. See that
    # module's own docstring for exactly why this position is safe to
    # mutate the context from.
    adaptive_questioning = AdaptiveQuestioningProcessor(selected_questions, is_resume=is_resume)

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            aggregators.user(),
            adaptive_questioning,
            llm,
            prosody,
            tts,
            transport.output(),
            aggregators.assistant(),
        ]
    )

    return pipeline, context, llm, adaptive_questioning


async def _speak_and_end(transport: BaseTransport, message: str) -> None:
    """Builds a minimal pipeline that speaks one message once the client is
    ready, then ends the call — used for every "the candidate can't
    actually join right now" outcome apps/api's join instruction reports
    (too early, expired, already completed — the exact wording is entirely
    apps/api's call now, via the instruction's "message" field)."""
    tts = build_tts_service()
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
        await worker.queue_frames([TTSSpeakFrame(message), EndFrame()])

    await runner.run()


async def _run_interview_bot(
    transport: BaseTransport,
    room_token: str,
    session_id: int,
    candidate_name: str,
    role_name: str,
    selected_questions: list[SelectedQuestion],
    prior_transcript: list[dict] | None = None,
) -> None:
    is_resume = prior_transcript is not None and len(prior_transcript) > 0
    pipeline, context, llm, adaptive_questioning = build_pipeline(
        transport, candidate_name, role_name, selected_questions, resume_messages=prior_transcript
    )

    # enable_usage_metrics is what makes STT/LLM/TTS services actually emit
    # the usage events usage_tracker.observer turns into totals — without
    # it, ServiceMetricsObserver never fires (see usage_tracking.py).
    usage_tracker = UsageTracker()
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        observers=[ConversationLogObserver(), usage_tracker.observer],
    )
    runner = WorkerRunner()
    await runner.add_workers(worker)

    my_connection_id = bump_connection(room_token)
    consent_logged = False
    ended_deliberately = False

    async def _handle_end_interview_call(params: FunctionCallParams) -> None:
        nonlocal ended_deliberately
        # The LLM decided the candidate explicitly asked to stop (see the
        # end_interview instruction/tool in agent/interview/prompt.py) — same
        # outcome as Room.tsx's "End Interview" button (on_client_message
        # below): mark it deliberate so the disconnect handler reports it
        # for immediate scoring, not a checkpoint-and-resume.
        ended_deliberately = True
        logger.info(f"Session {session_id} — LLM called end_interview (candidate asked to stop)")
        await params.result_callback({"status": "ending"})
        await worker.queue_frames(
            [
                TTSSpeakFrame("Understood — thank you for your time today. We'll wrap up the interview here."),
                EndFrame(),
            ]
        )

    llm.register_function(END_INTERVIEW_FUNCTION_NAME, _handle_end_interview_call)

    logger.info(f"{'Reconnected to' if is_resume else 'Interview starting —'} session {session_id} ({candidate_name}, {role_name})")

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        nonlocal consent_logged
        if not consent_logged:
            # The system prompt (agent/interview/prompt.py) makes the
            # recording/AI-evaluation notice the first thing the bot says —
            # reported here, once, right as that flow kicks off.
            try:
                await orchestrator_client.report_consent_given(session_id)
            except Exception as error:
                logger.error(f"Failed to report consent for session {session_id}: {error}")
            consent_logged = True

        # "developer"-role messages are silently dropped by Ollama's chat API
        # (see OLLamaLLMService.supports_developer_role in pipecat) — "user"
        # is what actually reaches the model there.
        if is_resume:
            context.add_message({"role": "user", "content": "[The candidate just reconnected after a brief interruption. Briefly acknowledge that and continue the interview from where it left off — don't restart or re-ask what's already been covered.]"})
        else:
            # AdaptiveQuestioningProcessor injects the first question itself
            # (see its "first turn for this question" branch) — this only
            # needs to kick off the recording notice and greeting.
            context.add_message({"role": "user", "content": "[Begin the interview now: start with the recording/AI-evaluation notice, then greet the candidate by name.]"})
        await worker.queue_frames([LLMRunFrame()])

    @worker.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, message):
        nonlocal ended_deliberately
        # Sent by Room.tsx's "End Interview" button just before it calls
        # disconnect() — the only reliable way to tell "the candidate is
        # deliberately done" apart from an accidental drop (network,
        # crashed tab, dead battery), since nothing else about a plain
        # WebRTC disconnect can distinguish the two.
        if message.type == "end_interview":
            ended_deliberately = True
            logger.info(f"Session {session_id} — candidate clicked End Interview")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Candidate disconnected — session {session_id} (connection {my_connection_id})")
        transcript = extract_transcript(context)
        await runner.cancel()

        if not is_current_connection(room_token, my_connection_id):
            # A newer connection has already taken over — that connection's
            # own disconnect handler owns reporting this now.
            logger.info(f"Session {session_id} — a newer connection already took over, not reporting")
            return

        try:
            # remaining_questions (not the original selected_questions) —
            # anything AdaptiveQuestioningProcessor already advanced past
            # is done; a resume should pick up at the current question, not
            # repeat every question from the start (see that class's
            # remaining_questions docstring).
            remaining = dtos_from_selected_questions(adaptive_questioning.remaining_questions)
            usage = usage_tracker.finish().as_dict()
            await orchestrator_client.report_disconnected(session_id, transcript, remaining, ended_deliberately, usage)
        except Exception as error:
            logger.error(f"Failed to report disconnect for session {session_id}: {error}")

    await runner.run()
