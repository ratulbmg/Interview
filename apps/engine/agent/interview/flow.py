"""Builds the fixed per-role system prompt for a live interview: the
static instructions (recording/consent notice, follow-up behavior, closing
line) plus this candidate's selected questions, in order. Relocated from
agent/voice/pipeline.py, verbatim — pure string templating of a fixed
question list, no branching about *when* the interview ends beyond the
static closing line already in the text.

Also defines the `end_interview` tool the LLM can call when the candidate
explicitly asks to stop early (see agent/conversation/manager.py, which
wires its handler) — the LLM decides *whether* to call it based on what the
candidate actually said, same as it already decides everything else about
conversation content; this file just describes the tool and when to use it,
it doesn't decide anything itself.
"""

from pipecat.adapters.schemas.function_schema import FunctionSchema

from agent.config import ACKNOWLEDGEMENT_PROBABILITY, ENABLE_ACKNOWLEDGEMENTS
from agent.interview.questions import SelectedQuestion

END_INTERVIEW_FUNCTION_NAME = "end_interview"

# Advertise-only schema (no handler here) — agent/conversation/manager.py
# registers the actual handler via llm.register_function once it has a
# PipelineWorker to speak the closing line and hang up through. Keeping the
# tool's definition next to the system prompt that tells the LLM when to use
# it, rather than off in the pipeline-wiring file, since they have to stay
# in sync with each other.
END_INTERVIEW_TOOL = FunctionSchema(
    name=END_INTERVIEW_FUNCTION_NAME,
    description=(
        "Call this the moment the candidate clearly and explicitly asks to end, stop, or quit "
        "the interview early — not for a normal answer, a question, or expressing that "
        "something is difficult. Call it with no other words in the same response; the system "
        "speaks its own closing line."
    ),
    properties={},
    required=[],
)


def _build_system_instruction(candidate_name: str, role_name: str, selected_questions: list[SelectedQuestion]) -> str:
    lines = [
        f"You are conducting a live, spoken job interview with {candidate_name} for the "
        f"{role_name} role. Speak naturally and conversationally — your responses are spoken "
        "aloud, so never use emojis, bullet points, markdown, or anything that can't be spoken.",
        # Qwen3 (and some other reasoning models) burn several seconds
        # thinking through a hidden chain-of-thought before every reply
        # unless told not to — fine for CV parsing/scoring (not
        # latency-sensitive, see agent/llm/client.py), unacceptable for a
        # live spoken turn. Harmless no-op text for a model that doesn't
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
        f"If the candidate clearly and explicitly asks to end, stop, or quit the interview early "
        f"(for example: \"I want to stop\", \"can we end this now\", \"I need to go\", \"I don't "
        f"want to continue\") — as opposed to just answering a question or saying something is "
        f"difficult — do not respond with your own words at all. Call the {END_INTERVIEW_FUNCTION_NAME} "
        f"function immediately instead, with no other text in that response.",
        "",
        "Ask the following questions IN ORDER, one at a time. After each answer, ask 1-2 short, natural "
        "follow-up questions that probe deeper into what the candidate actually said (specifics, "
        "trade-offs, a detail they glossed over) before moving to the next question — but don't force a "
        "follow-up if the answer already fully covers the topic.",
        "",
    ]
    if ENABLE_ACKNOWLEDGEMENTS:
        lines += [
            f"Occasionally (not every turn) use a brief, professional acknowledgement like 'Okay,', "
            f"'Understood,', or 'Thank you' before continuing — roughly {round(ACKNOWLEDGEMENT_PROBABILITY * 100)}% "
            "of the time, never more than that.",
            "",
        ]
    for i, item in enumerate(selected_questions, start=1):
        lines.append(f"{i}. [{item.slot}] {item.question.text}")
    lines += [
        "",
        "After the last question, thank the candidate, let them know the interview is complete, "
        "say goodbye, and stop talking.",
    ]
    return "\n".join(lines)
