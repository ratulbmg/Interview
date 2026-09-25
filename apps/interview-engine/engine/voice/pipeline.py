"""Builds the STT -> LLM -> TTS pipeline for one candidate's interview.

The question flow is encoded declaratively in the LLM's system prompt
(the fixed, per-role blueprint slots, filled with this candidate's
selected questions — see question_selector.py) rather than driven
turn-by-turn by this module: a live voice conversation needs the LLM
itself asking natural 1-2 follow-ups as the candidate answers, which is
what it's already doing every turn, not a separate scripted step (compare
apps/interview-engine/engine/interview_loop.py's text-only CLI, which calls
out to the LLM explicitly between turns because there's no live
conversational loop to piggyback on there).

STT and TTS talk to self-hosted Docker containers (speaches, kokoro-fastapi
— see docker-compose.yml) over their own OpenAI-compatible endpoints,
rather than running in-process the way MLX Whisper/Kokoro used to: MLX is
Apple-Silicon/macOS-only and can't run in a Linux container at all, so
Dockerizing STT/TTS meant swapping engines, not just relocating them.
"""

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.stt import OpenAISTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.base_transport import BaseTransport

from engine.config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    STT_API_KEY,
    STT_BASE_URL,
    TTS_API_KEY,
    TTS_BASE_URL,
    VOICE_LLM_MODEL,
    VOICE_STT_MODEL,
    VOICE_TTS_VOICE,
)
from engine.voice.ready_rooms import ReadySession


def _build_system_instruction(session: ReadySession) -> str:
    lines = [
        f"You are conducting a live, spoken job interview with {session.candidate_name} for the "
        f"{session.role_name} role. Speak naturally and conversationally — your responses are spoken "
        "aloud, so never use emojis, bullet points, markdown, or anything that can't be spoken.",
        # Qwen3 (and some other reasoning models) burn several seconds
        # thinking through a hidden chain-of-thought before every reply
        # unless told not to — fine for CV parsing/scoring (not
        # latency-sensitive, see llm_client.py), unacceptable for a live
        # spoken turn. Harmless no-op text for a model that doesn't
        # recognize the directive. Remove if VOICE_LLM_MODEL isn't a
        # thinking model.
        "/no_think",
        "",
        "Before anything else — this is the very first thing you say, before any question: tell the "
        "candidate this interview is being recorded and evaluated by an AI system, and ask them to "
        "confirm they're okay to proceed. Wait for their response before continuing.",
        "",
        "If you don't understand what the candidate said, or there's a long silence, don't guess — "
        "politely say you didn't catch that (or ask if their connection is okay) and ask them to repeat "
        "it, rather than moving on or making up an answer they didn't give.",
        "",
        "Ask the following questions IN ORDER, one at a time. After each answer, ask 1-2 short, natural "
        "follow-up questions that probe deeper into what the candidate actually said (specifics, "
        "trade-offs, a detail they glossed over) before moving to the next question — but don't force a "
        "follow-up if the answer already fully covers the topic.",
        "",
    ]
    for i, item in enumerate(session.selected_questions, start=1):
        lines.append(f"{i}. [{item.slot}] {item.question.text}")
    lines += [
        "",
        "After the last question, thank the candidate, let them know the interview is complete, "
        "say goodbye, and stop talking.",
    ]
    return "\n".join(lines)


def build_pipeline(transport: BaseTransport, session: ReadySession, resume_messages: list[dict] | None = None) -> tuple[Pipeline, LLMContext]:
    """`resume_messages` seeds the context on a reconnect (see server.py's
    on_client_disconnected/RECONNECT_GRACE_SECONDS, Phase 8) so the LLM
    picks the conversation back up instead of starting over.

    STT and TTS each talk to their own self-hosted, OpenAI-compatible
    Docker container (STT_BASE_URL/TTS_BASE_URL — see docker-compose.yml
    and engine/config.py), same as the LLM talks to Ollama over
    LLM_BASE_URL. Plain OpenAILLMService rather than pipecat's
    OLLamaLLMService wrapper: that wrapper hardcodes Ollama's dummy API key
    internally and has no way to override it, which breaks any
    OpenAI-compatible server that actually enforces one (LM Studio's
    does)."""
    stt = OpenAISTTService(base_url=STT_BASE_URL, api_key=STT_API_KEY, settings=OpenAISTTService.Settings(model=VOICE_STT_MODEL))

    tts = OpenAITTSService(base_url=TTS_BASE_URL, api_key=TTS_API_KEY, settings=OpenAITTSService.Settings(voice=VOICE_TTS_VOICE))

    llm = OpenAILLMService(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        settings=OpenAILLMService.Settings(
            model=VOICE_LLM_MODEL,
            system_instruction=_build_system_instruction(session),
        ),
    )

    context = LLMContext(messages=resume_messages or None)
    # SileroVADAnalyzer on the user aggregator is what gives this pipeline
    # both turn detection (knowing when the candidate has finished
    # speaking) and barge-in (new user speech interrupts the bot's TTS
    # mid-sentence) — both are default pipeline behavior once VAD is wired
    # in, not something built by hand here.
    # Default stop_secs (0.2s) decides the candidate is done talking after a
    # very short pause, splitting normal mid-sentence pauses into separate
    # turns and making the bot interrupt/re-ask instead of waiting for a full
    # answer — bump it so it waits for a more natural conversational gap.
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.8))),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            aggregators.user(),
            llm,
            tts,
            transport.output(),
            aggregators.assistant(),
        ]
    )

    return pipeline, context


def extract_transcript(context: LLMContext) -> list[dict]:
    """context.messages holds only the user/assistant turns — the system
    prompt is a service setting (OpenAILLMService.Settings.system_instruction),
    not a context message, under this Pipecat version's pattern."""
    return [{"role": m.get("role"), "content": m.get("content")} for m in context.messages]
