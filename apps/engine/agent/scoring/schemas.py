"""Pydantic request/response models for the inbound /score route (see
routes.py) and for the evaluation result itself (CompetencyScore,
DimensionScore, ScoringResult). No LLM calls and no scoring logic here —
those live in competency_scorer.py/dimension_scorer.py/evaluator.py. Wire-
format conversion between these DTOs and the domain objects interview/
works with (SelectedQuestion, QuestionRecord) lives in serializers.py
instead — a materially different concern from "what shape must this data
be," and one several non-scoring callers (voice/server.py, jobs/consumer.py,
agent/interview/adaptive_questioning.py's caller in conversation/manager.py)
depend on independently of the /score route itself.
"""

from typing import Literal

from pydantic import BaseModel, Field

Score = Literal[1, 2, 3, 4, 5]


class TranscriptTurn(BaseModel):
    role: str
    content: str


class SelectedQuestionDto(BaseModel):
    """Carries apps/engine's full adaptive-questioning metadata through
    apps/api's checkpoint round-trip — a session's questions are only ever
    selected once (agent-start, with the full QuestionRecord available),
    but every later join ("start" for a fresh session, "resume" after a
    dropped connection) reconstructs SelectedQuestion from exactly this
    DTO via serializers.py's selected_questions_from_dtos. A field missing
    here is a field answer_analyzer.py/followup_policy.py can never see
    once the interview is actually live."""

    id: int
    slot: str
    competency: str
    questionText: str
    difficulty: str
    questionType: str
    objective: str | None
    expectedSignals: list[str]
    maxFollowups: int
    maxDurationSeconds: int


class ScoreRequest(BaseModel):
    transcript: list[TranscriptTurn]
    selectedQuestions: list[SelectedQuestionDto]
    roleName: str


class ScoreResponse(BaseModel):
    report: dict


class CompetencyScore(BaseModel):
    """Was the technical competency represented by one or more selected
    questions actually demonstrated — see competency_scorer.py, the only
    place these get constructed. `score` uses the 1-5 scale defined in
    prompts/competency.py; Literal here is what actually enforces "must be
    an integer 1 through 5," not just documentation."""

    competency: str = Field(min_length=1)
    score: Score
    evidence: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


DimensionName = Literal[
    "communication",
    "confidence",
    "problem_solving",
    "technical_depth",
    "ownership",
    "decision_making",
    "adaptability",
]


class DimensionScore(BaseModel):
    """How the candidate performed on one interview-wide behavioral/
    professional dimension — see dimension_scorer.py, the only place
    these get constructed. Never derived from or merged with
    CompetencyScore above; a competency score and a dimension score
    measure different constructs (see evaluator.py's module docstring)."""

    dimension: DimensionName
    score: Score
    evidence: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


class ScoringResult(BaseModel):
    """The complete, structured post-interview evaluation — see
    aggregation.py, the only place this gets constructed. Deliberately no
    overall 0-100 score: competencies and dimensions aren't on the same
    scale or measuring the same thing, so nothing here averages them."""

    role: str
    competencies: list[CompetencyScore]
    dimensions: list[DimensionScore]
    summary: str
