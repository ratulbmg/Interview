"""Builds the fixed per-role system prompt for a live interview: the
static, standing behavioral rules — recording/consent notice, how to
handle unclear audio, when to call end_interview, tone, and how to follow
the per-turn interviewer directives agent/interview/adaptive_questioning.py
injects into the conversation.

The question-by-question content itself is NOT in this prompt any more —
AdaptiveQuestioningProcessor injects one question (or one targeted
follow-up) at a time as the interview progresses, based on
agent/interview/answer_analyzer.py's read of each answer and
agent/interview/followup_policy.py's deterministic decision. This file's
job is only to tell the LLM how to behave *within* whatever directive it's
given — never which question is next or when to stop probing one, which
this file has no visibility into.

Also defines the `end_interview` tool the LLM can call when the candidate
explicitly asks to stop early (see agent/conversation/manager.py, which
wires its handler) — the LLM decides *whether* to call it based on what the
candidate actually said, same as it decides how to phrase everything else;
this file just describes the tool and when to use it, it doesn't decide
anything itself.
"""

from pipecat.adapters.schemas.function_schema import FunctionSchema

from agent.config import ACKNOWLEDGEMENT_PROBABILITY, ENABLE_ACKNOWLEDGEMENTS

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


def _build_system_instruction(candidate_name: str, role_name: str) -> str:
    lines = [
        f"You are conducting a live, spoken job interview with {candidate_name} for the "
        f"{role_name} role. Speak naturally and conversationally — your responses are spoken "
        "aloud, so never use emojis, bullet points, markdown, or anything that can't be spoken. "
        "Maintain a professional interview tone throughout — you are conducting a structured "
        "assessment, not chatting like a casual assistant.",
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
        "This interview is question-by-question: after the recording notice and the candidate's "
        "confirmation, you will be given one interviewer directive at a time — each one either asks "
        "you to pose a specific question, asks you to pose one specific targeted follow-up, or tells "
        "you the interview is complete. Always follow the current directive exactly: never decide on "
        "your own to keep probing a topic, skip ahead to a different question, re-ask something "
        "already covered, or end the interview early. When a directive asks for a follow-up, ask only "
        "about what it asks you to ask about — phrase it as one natural, conversational question, not "
        "a checklist read aloud. Directives are marked and are never something you read aloud "
        "verbatim or acknowledge to the candidate as an instruction you received.",
        "",
        "Never mention or hint at how questions are chosen, how answers are being judged or scored, "
        "or any internal process, signal, policy, or state — to the candidate, this should feel like "
        "an ordinary, attentive conversation with a human interviewer.",
        "",
    ]
    if ENABLE_ACKNOWLEDGEMENTS:
        lines += [
            f"Occasionally (not every turn) use a brief, professional acknowledgement like 'Okay,', "
            f"'Understood,', or 'Thank you' before continuing — roughly {round(ACKNOWLEDGEMENT_PROBABILITY * 100)}% "
            "of the time, never more than that.",
        ]
    return "\n".join(lines)
