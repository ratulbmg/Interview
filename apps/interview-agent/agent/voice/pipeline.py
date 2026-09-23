"""Builds the STT -> LLM -> TTS pipeline for one candidate's interview.

The question flow is encoded declaratively in the LLM's system prompt
(the fixed, per-role blueprint slots, filled with this candidate's
selected questions — see question_selector.py) rather than driven
turn-by-turn by this module: a live voice conversation needs the LLM
itself asking natural 1-2 follow-ups as the candidate answers, which is
what it's already doing every turn, not a separate scripted step (compare
apps/interview-agent/agent/interview_loop.py's text-only CLI, which calls
out to the LLM explicitly between turns because there's no live
conversational loop to piggyback on there).
"""

from pipecat.audio.vad.silero import SileroVADAnalyzer
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

from agent.config import OPENAI_API_KEY, OPENAI_VOICE_CHAT_MODEL, OPENAI_VOICE_ID
from agent.voice.ready_rooms import ReadySession


def _build_system_instruction(session: ReadySession) -> str:
    lines = [
        f"You are conducting a live, spoken job interview with {session.candidate_name} for the "
        f"{session.role_name} role. Speak naturally and conversationally — your responses are spoken "
        "aloud, so never use emojis, bullet points, markdown, or anything that can't be spoken.",
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


def build_pipeline(transport: BaseTransport, session: ReadySession) -> tuple[Pipeline, LLMContext]:
    stt = OpenAISTTService(api_key=OPENAI_API_KEY)

    tts = OpenAITTSService(
        api_key=OPENAI_API_KEY,
        settings=OpenAITTSService.Settings(voice=OPENAI_VOICE_ID),
    )

    llm = OpenAILLMService(
        api_key=OPENAI_API_KEY,
        settings=OpenAILLMService.Settings(
            model=OPENAI_VOICE_CHAT_MODEL,
            system_instruction=_build_system_instruction(session),
        ),
    )

    context = LLMContext()
    # SileroVADAnalyzer on the user aggregator is what gives this pipeline
    # both turn detection (knowing when the candidate has finished
    # speaking) and barge-in (new user speech interrupts the bot's TTS
    # mid-sentence) — both are default pipeline behavior once VAD is wired
    # in, not something built by hand here.
    aggregators = LLMContextAggregatorPair(context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()))

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
