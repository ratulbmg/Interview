"""Scores the seven interview-wide behavioral/professional dimensions —
"how did the candidate perform across the whole interview," never "did
they demonstrate this one competency" (that's competency_scorer.py's
separate job; see evaluator.py for why the two stay apart).

One LLM call covering all seven dimensions together, not seven separate
calls — the prompt (prompts/dimensions.py) asks for all of them in a
single structured response.
"""

from loguru import logger
from pydantic import BaseModel, ValidationError

from agent.llm import client as llm_client
from agent.scoring.prompts.dimensions import DIMENSION_SCORING_SYSTEM_PROMPT
from agent.scoring.schemas import DimensionName, DimensionScore
from agent.scoring.serializers import transcript_to_text

ALL_DIMENSIONS: tuple[DimensionName, ...] = (
    "communication",
    "confidence",
    "problem_solving",
    "technical_depth",
    "ownership",
    "decision_making",
    "adaptability",
)


class _RawDimensionsResponse(BaseModel):
    dimensions: list[DimensionScore]


def score_dimensions(transcript: list[dict], role_name: str) -> list[DimensionScore]:
    transcript_text = transcript_to_text(transcript)
    user_prompt = f"Role: {role_name}\n\nFull interview transcript:\n{transcript_text}"

    raw = llm_client.chat_json(DIMENSION_SCORING_SYSTEM_PROMPT, user_prompt)
    try:
        parsed = _RawDimensionsResponse.model_validate(raw)
    except ValidationError as error:
        logger.error(f"dimension_scorer: malformed LLM output: {raw!r}")
        raise ValueError(f"Dimension scoring didn't match the expected schema: {error}") from error

    # A whole dimension missing from the response is an incomplete result,
    # not a malformed one (each individual dimension object that IS
    # present was already schema-validated above) — log and proceed with
    # what came back rather than failing the entire evaluation over one
    # omitted dimension.
    returned = {d.dimension for d in parsed.dimensions}
    missing = [name for name in ALL_DIMENSIONS if name not in returned]
    if missing:
        logger.warning(f"dimension_scorer: LLM omitted dimensions {missing} — proceeding with what was returned")

    return parsed.dimensions
