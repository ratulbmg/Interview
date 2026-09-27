"""Pydantic request/response models for the inbound /score route (see
routes.py), plus the SelectedQuestion <-> wire-format conversion helpers
apps/api's join-instruction and /score payloads both use.

Relocated from agent/voice/server.py's module-level helpers, formerly
named _selected_questions_from_dicts/_dicts_from_selected_questions —
renamed without the leading underscore since callers outside
voice/server.py (routes.py below, agent/conversation/manager.py) use them
now.
"""

from pydantic import BaseModel

from agent.interview.db import QuestionRecord
from agent.interview.questions import SelectedQuestion


class TranscriptTurn(BaseModel):
    role: str
    content: str


class SelectedQuestionDto(BaseModel):
    slot: str
    competency: str
    questionText: str


class ScoreRequest(BaseModel):
    transcript: list[TranscriptTurn]
    selectedQuestions: list[SelectedQuestionDto]
    roleName: str


class ScoreResponse(BaseModel):
    report: dict


def _field(item, key: str):
    """Items come from two different sources: /score's Pydantic-validated
    SelectedQuestionDto objects (routes.py) and apps/api's raw join()
    instruction JSON, still a plain dict at that point
    (agent/voice/server.py's bot()) — accept either without forcing every
    call site to convert first."""
    return item[key] if isinstance(item, dict) else getattr(item, key)


def selected_questions_from_dtos(items: list) -> list[SelectedQuestion]:
    """Reconstructs the SelectedQuestion objects evaluator.py/manager.py
    need from the plain {"slot", "competency", "questionText"} shape both
    apps/api's join instructions and /score's request body use — only
    slot/competency/text ever matter again once questions have been
    selected, so the rest of QuestionRecord is filled with safe
    placeholders nothing downstream reads."""
    return [
        SelectedQuestion(
            slot=_field(item, "slot"),
            competency=_field(item, "competency"),
            question=QuestionRecord(
                id=0,
                text=_field(item, "questionText"),
                competency=_field(item, "competency"),
                difficulty="",
                tags=[],
                embedding=None,
                times_asked=0,
                last_asked_at=None,
            ),
        )
        for item in items
    ]


def dtos_from_selected_questions(items: list[SelectedQuestion]) -> list[dict]:
    """The reverse direction, used by agent/conversation/manager.py before
    reporting a disconnect back to apps/api — kept as plain dicts (not
    SelectedQuestionDto instances) since that's what orchestrator_client.py's httpx
    call JSON-serializes directly."""
    return [{"slot": q.slot, "competency": q.competency, "questionText": q.question.text} for q in items]
