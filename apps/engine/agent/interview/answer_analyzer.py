"""Evaluates ONE candidate answer against the current question's expected
signals — nothing else.

This module never decides whether to follow up or move to the next
question (that's followup_policy.py's job, deterministically) and never
scores overall interview performance (that's evaluator.py's job, at the
end of the whole interview). Its only question: "does this answer, plus
whatever's already been covered in this topic, provide real evidence for
each expected signal."
"""

from dataclasses import dataclass
from typing import Literal

from loguru import logger
from pydantic import BaseModel, Field, ValidationError

from agent.llm import client as llm_client

AnswerQuality = Literal["SUFFICIENT", "PARTIAL", "INSUFFICIENT", "OFF_TOPIC"]
NextAction = Literal["NEXT_QUESTION", "FOLLOW_UP"]

SYSTEM_PROMPT = """You are analyzing ONE candidate answer during a live spoken job interview, \
against a specific question's expected signals. Your only job is to judge whether the answer \
gives real evidence for each expected signal — never invent evidence, and never treat "not \
mentioned" as proof the candidate lacks something. A signal the answer doesn't address is \
missing, not disproven.

You are given the signals already covered earlier in this same topic (from a previous answer, if \
any) — a signal covered before stays covered even if this specific answer doesn't restate it.

Return a single JSON object with exactly these keys:
- "covered_signals": array of strings — every expected signal (only from the list you're given, \
never invent new ones) that is now covered, combining this answer with anything already covered \
earlier in this topic.
- "missing_signals": array of strings — every expected signal not yet covered.
- "answer_quality": one of "SUFFICIENT" (all or nearly all signals covered, well-evidenced), \
"PARTIAL" (some signals covered, meaningful gaps remain), "INSUFFICIENT" (little or no real \
evidence for the expected signals), "OFF_TOPIC" (the answer doesn't address the question at all).
- "next_action": one of "NEXT_QUESTION" or "FOLLOW_UP" — your recommendation only; the \
application makes the final call using its own limits, not this field alone."""


class AnswerAnalysis(BaseModel):
    covered_signals: list[str] = Field(default_factory=list)
    missing_signals: list[str] = Field(default_factory=list)
    answer_quality: AnswerQuality
    next_action: NextAction


@dataclass
class AnalyzerInput:
    question_text: str
    objective: str | None
    expected_signals: list[str]
    answer_text: str
    previously_covered_signals: list[str]


def analyze_answer(input_data: AnalyzerInput) -> AnswerAnalysis:
    if not input_data.expected_signals:
        # A question with no expectedSignals (added before this system
        # existed, or authored without them) — nothing to analyze against.
        # Don't invent detailed signals at runtime; fall back to
        # SUFFICIENT/NEXT_QUESTION so followup_policy.py's deterministic
        # turn/duration limits are the only thing governing this topic.
        logger.warning(f"answer_analyzer: question {input_data.question_text!r} has no expectedSignals — skipping adaptive analysis")
        return AnswerAnalysis(answer_quality="SUFFICIENT", next_action="NEXT_QUESTION")

    user_prompt = (
        f"Question: {input_data.question_text}\n"
        f"Objective: {input_data.objective or '(not specified)'}\n"
        f"Expected signals: {input_data.expected_signals}\n"
        f"Already covered earlier in this topic: {input_data.previously_covered_signals}\n"
        f"Candidate's latest answer: {input_data.answer_text}"
    )
    raw = llm_client.chat_json(SYSTEM_PROMPT, user_prompt)
    try:
        analysis = AnswerAnalysis.model_validate(raw)
    except ValidationError as error:
        raise ValueError(f"Answer analysis didn't match the expected schema: {error}") from error

    # Defensive filter — "never invent evidence" is a prompt instruction,
    # not a guarantee. Drop anything the model reported that wasn't in the
    # list it was actually given, and recompute missing from what's left.
    valid_signals = set(input_data.expected_signals)
    analysis.covered_signals = [s for s in analysis.covered_signals if s in valid_signals]
    analysis.missing_signals = [s for s in input_data.expected_signals if s not in analysis.covered_signals]

    return analysis
