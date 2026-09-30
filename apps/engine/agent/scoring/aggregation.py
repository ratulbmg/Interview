"""Combines competency and dimension scores into the final structured
result. No arbitrary overall 0-100 score, and no averaging competencies
with dimensions — they measure different constructs (role-specific
technical competencies vs. whole-interview behavioral dimensions), so
nothing here collapses them into one number.

The one synthesis this module does add is a short text summary — built
deterministically from the already-validated scores below, never its own
LLM call. A summary is the one place a free-form LLM generation would be
tempted to editorialize or invent a claim the structured scores don't
support; templating it from the scores themselves keeps it strictly
evidence-grounded and keeps the individual scores visible rather than
hidden behind a synthesized paragraph.
"""

from agent.scoring.schemas import CompetencyScore, DimensionScore, ScoringResult

_STRONG = "Demonstrated strong evidence of {label}: {items}."
_ADEQUATE = "Provided adequate evidence of {label}: {items}."
_LIMITED = "Provided limited evidence of {label}: {items}."
_INSUFFICIENT = "Did not provide sufficient evidence for {label}: {items}."


def _summarize_tier(label: str, named_scores: list[tuple[str, int]]) -> list[str]:
    tiers: dict[int, list[str]] = {1: [], 2: [], 3: [], 4: [], 5: []}
    for name, score in named_scores:
        tiers[score].append(name)

    lines = []
    if tiers[5] or tiers[4]:
        lines.append(_STRONG.format(label=label, items=", ".join(tiers[5] + tiers[4])))
    if tiers[3]:
        lines.append(_ADEQUATE.format(label=label, items=", ".join(tiers[3])))
    if tiers[2]:
        lines.append(_LIMITED.format(label=label, items=", ".join(tiers[2])))
    if tiers[1]:
        lines.append(_INSUFFICIENT.format(label=label, items=", ".join(tiers[1])))
    return lines


def _build_summary(competencies: list[CompetencyScore], dimensions: list[DimensionScore]) -> str:
    lines = _summarize_tier("competencies", [(c.competency, c.score) for c in competencies])
    lines += _summarize_tier("interview dimensions", [(d.dimension, d.score) for d in dimensions])
    return " ".join(lines) if lines else "No scoring evidence was available for this interview."


def aggregate_results(
    role_name: str,
    competencies: list[CompetencyScore],
    dimensions: list[DimensionScore],
) -> ScoringResult:
    return ScoringResult(
        role=role_name,
        competencies=competencies,
        dimensions=dimensions,
        summary=_build_summary(competencies, dimensions),
    )
