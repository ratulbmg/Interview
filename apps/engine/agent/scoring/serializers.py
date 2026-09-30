"""Wire-format conversion between SelectedQuestionDto (schemas.py) and the
domain objects interview/ actually works with (SelectedQuestion,
QuestionRecord).

Split out of schemas.py on purpose: these functions aren't about what a
/score request looks like, they're about converting between the DB-shaped
question and the wire-format DTO — used by voice/server.py and
jobs/consumer.py and agent/interview/adaptive_questioning.py's caller in
conversation/manager.py, none of which care about the /score route itself.

Relocated from agent/voice/server.py's module-level helpers, formerly
named _selected_questions_from_dicts/_dicts_from_selected_questions —
renamed without the leading underscore once callers outside voice/server.py
started using them.
"""

from agent.interview.agent_data_client import QuestionRecord
from agent.interview.questions import SelectedQuestion


def _field(item, key: str):
    """Items come from two different sources: /score's Pydantic-validated
    SelectedQuestionDto objects (routes.py) and apps/api's raw join()
    instruction JSON, still a plain dict at that point
    (agent/voice/server.py's bot()) — accept either without forcing every
    call site to convert first."""
    return item[key] if isinstance(item, dict) else getattr(item, key)


def selected_questions_from_dtos(items: list) -> list[SelectedQuestion]:
    """Reconstructs the SelectedQuestion objects evaluator.py/manager.py/
    the adaptive layer (interview_state.py, answer_analyzer.py,
    followup_policy.py) need from the wire-format DTO both apps/api's join
    instructions and /score's request body use. tags/times_asked/
    last_asked_at genuinely don't matter again once a question has been
    selected (nothing downstream reads them), so those stay safe
    placeholders — but every adaptive field does matter live, so those
    come straight from the DTO, not a placeholder."""
    return [
        SelectedQuestion(
            slot=_field(item, "slot"),
            competency=_field(item, "competency"),
            question=QuestionRecord(
                id=_field(item, "id"),
                text=_field(item, "questionText"),
                competency=_field(item, "competency"),
                difficulty=_field(item, "difficulty"),
                tags=[],
                embedding=None,
                times_asked=0,
                last_asked_at=None,
                question_type=_field(item, "questionType"),
                objective=_field(item, "objective"),
                expected_signals=_field(item, "expectedSignals"),
                max_followups=_field(item, "maxFollowups"),
                max_duration_seconds=_field(item, "maxDurationSeconds"),
            ),
        )
        for item in items
    ]


def transcript_to_text(transcript: list[dict]) -> str:
    """Renders the transcript as plain text for a scoring prompt — every
    turn, both interviewer and candidate, so the model has enough context
    to understand what a candidate answer was actually responding to (a
    follow-up only makes sense next to the question it followed). Used by
    both competency_scorer.py and dimension_scorer.py; the instruction
    that evidence must be a candidate quote, never an interviewer one,
    lives in the prompts themselves (prompts/competency.py,
    prompts/dimensions.py), not in this formatting."""
    return "\n".join(f"{turn.get('role', '?')}: {turn.get('content', '')}" for turn in transcript)


def dtos_from_selected_questions(items: list[SelectedQuestion]) -> list[dict]:
    """The reverse direction, used by agent/jobs/consumer.py right after
    selection and by agent/conversation/manager.py before reporting a
    disconnect — kept as plain dicts (not SelectedQuestionDto instances)
    since that's what orchestrator_client.py's httpx call JSON-serializes
    directly. Must emit every field SelectedQuestionDto declares, or that
    field is silently gone the next time this session is joined."""
    return [
        {
            "id": q.question.id,
            "slot": q.slot,
            "competency": q.competency,
            "questionText": q.question.text,
            "difficulty": q.question.difficulty,
            "questionType": q.question.question_type,
            "objective": q.question.objective,
            "expectedSignals": q.question.expected_signals,
            "maxFollowups": q.question.max_followups,
            "maxDurationSeconds": q.question.max_duration_seconds,
        }
        for q in items
    ]
