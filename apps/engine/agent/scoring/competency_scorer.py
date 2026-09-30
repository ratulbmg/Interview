"""Scores each distinct technical competency the interview actually
covered — "did the candidate demonstrate this," never "how did the whole
interview go" (that's dimension_scorer.py's separate job; see evaluator.py
for why the two stay apart).

One LLM call per distinct competency, not per question: a role's blueprint
only ever asks a given competency's slot once (see packages/db/src/
seed.ts), so this is naturally already deduplicated — de-duped again here
defensively rather than assumed, exactly as the prior implementation did.
"""

from loguru import logger
from pydantic import BaseModel, Field, ValidationError

from agent.interview.questions import SelectedQuestion
from agent.llm import client as llm_client
from agent.scoring.prompts.competency import COMPETENCY_SCORING_SYSTEM_PROMPT
from agent.scoring.schemas import CompetencyScore, Score
from agent.scoring.serializers import transcript_to_text


class _RawCompetencyScore(BaseModel):
    """What the LLM is expected to return for one competency — validated
    before it ever becomes the real CompetencyScore below, which also
    needs the competency name (already known here, never asked of the
    model)."""

    score: Score
    evidence: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


def score_competencies(
    transcript: list[dict],
    selected_questions: list[SelectedQuestion],
    role_name: str,
) -> list[CompetencyScore]:
    transcript_text = transcript_to_text(transcript)

    seen: set[str] = set()
    scores: list[CompetencyScore] = []

    for item in selected_questions:
        if item.competency in seen:
            continue
        seen.add(item.competency)

        user_prompt = f"Role: {role_name}\nCompetency to evaluate: {item.competency}\n\nFull interview transcript:\n{transcript_text}"
        raw = llm_client.chat_json(COMPETENCY_SCORING_SYSTEM_PROMPT, user_prompt)
        try:
            parsed = _RawCompetencyScore.model_validate(raw)
        except ValidationError as error:
            logger.error(f"competency_scorer: malformed LLM output for competency {item.competency!r}: {raw!r}")
            raise ValueError(f"Competency scoring for {item.competency!r} didn't match the expected schema: {error}") from error

        scores.append(
            CompetencyScore(
                competency=item.competency,
                score=parsed.score,
                evidence=parsed.evidence,
                rationale=parsed.rationale,
            )
        )

    return scores
