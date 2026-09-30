"""Deterministic follow-up/next-question decision.

The LLM never decides whether it's allowed to keep probing a topic —
answer_analyzer.py's `next_action` is advisory input only. This module
makes the actual call, in plain Python, and its hard limits (maxFollowups,
maxDurationSeconds) can never be exceeded regardless of what the analyzer
or the conversational LLM would otherwise prefer. Turn/duration limits are
safety rails here, not the evaluation mechanism — signal coverage and
answer sufficiency are checked first; the limits only ever force an early
NEXT_QUESTION, never an early FOLLOW_UP.
"""

from dataclasses import dataclass
from typing import Literal

from loguru import logger

from agent.interview.answer_analyzer import AnswerAnalysis
from agent.interview.interview_state import InterviewState

PolicyDecision = Literal["NEXT_QUESTION", "FOLLOW_UP"]

# Used only when a question's own metadata is missing or non-positive
# (a legacy question, or bad data) — see decide_next_action below.
DEFAULT_MAX_FOLLOWUPS = 2
DEFAULT_MAX_TOPIC_DURATION_SECONDS = 180


@dataclass
class FollowupPolicyInput:
    state: InterviewState
    analysis: AnswerAnalysis
    max_followups: int
    max_duration_seconds: int


def decide_next_action(input_data: FollowupPolicyInput) -> PolicyDecision:
    state = input_data.state
    analysis = input_data.analysis
    max_followups = input_data.max_followups if input_data.max_followups > 0 else DEFAULT_MAX_FOLLOWUPS
    max_duration = input_data.max_duration_seconds if input_data.max_duration_seconds > 0 else DEFAULT_MAX_TOPIC_DURATION_SECONDS
    elapsed = state.elapsed_seconds()

    # Checked in this exact order: coverage and sufficiency first, hard
    # limits as a backstop, never the other way around.
    if not state.missing_signals:
        decision, reason = "NEXT_QUESTION", "all expected signals covered"
    elif state.followup_count >= max_followups:
        decision, reason = "NEXT_QUESTION", "maxFollowups reached"
    elif elapsed >= max_duration:
        decision, reason = "NEXT_QUESTION", "maxDurationSeconds reached"
    elif analysis.answer_quality == "SUFFICIENT":
        decision, reason = "NEXT_QUESTION", "answer judged sufficient"
    else:
        # Signals still missing, sufficiency not yet reached, and budget
        # remains — follow up, regardless of what the analyzer's own
        # next_action suggested; that field is advisory only.
        decision, reason = "FOLLOW_UP", "signals missing and follow-up budget remains"

    logger.info(
        f"followup_policy: question {state.current_question_id} ({state.current_competency}) -> {decision} "
        f"({reason}; covered={state.covered_signals}, missing={state.missing_signals}, "
        f"followups={state.followup_count}/{max_followups}, elapsed={elapsed:.0f}s/{max_duration}s)"
    )
    return decision
