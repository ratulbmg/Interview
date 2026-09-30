/**
 * Derives an Eligible / Not Eligible verdict from a completed session's
 * scored report (apps/engine's ScoringResult — see agent/scoring/schemas.py)
 * for the recruiter-facing Results screen. This is deliberately NOT part of
 * the scoring engine's own output: apps/engine's aggregation.py explicitly
 * never produces an overall 0-100 score or a pass/fail verdict, since a
 * competency score and a dimension score measure different constructs and
 * nothing should silently average them. This threshold is a separate,
 * explicit business rule that only exists for this one screen — the
 * underlying report stays exactly as scored, un-averaged, in reportJson.
 */

// Hardcoded per explicit product decision — not derived, not configurable
// yet. If this ever needs to vary by role or be recruiter-adjustable, that's
// a real feature to design, not a constant to read from an env var.
export const ELIGIBILITY_THRESHOLD_PERCENT = 80;

// A score of 1-2 ("no meaningful" / "limited or weak" per the scoring
// rubric — see agent/scoring/prompts/competency.py) is what counts as a
// concrete weakness worth surfacing as a reason a candidate wasn't selected.
const NEGATIVE_SCORE_CUTOFF = 2;

interface ScoredItem {
  score: number;
  evidence: string;
}

interface CompetencyScore extends ScoredItem {
  competency: string;
}

interface DimensionScore extends ScoredItem {
  dimension: string;
}

/** Matches apps/engine's ScoringResult exactly (agent/scoring/schemas.py) —
 * kept as a narrow local interface rather than a shared package since
 * apps/api treats reportJson as opaque data everywhere else, and this is
 * the one place that needs to actually read into its shape. */
export interface ScoringResult {
  role: string;
  competencies: CompetencyScore[];
  dimensions: DimensionScore[];
  summary: string;
}

export interface NegativePoint {
  label: string;
  score: number;
  evidence: string;
}

export interface DimensionSummary {
  dimension: string;
  score: number;
}

export interface EligibilityResult {
  overallPercentage: number;
  eligible: boolean;
  negativePoints: NegativePoint[];
  /** Score only, per dimension — no evidence — for aggregate display (see
   * the recruiter Dashboard's evaluation-summary section, which averages
   * this across sessions). Already parsed above for overallPercentage;
   * surfaced here instead of discarded, not a new computation. */
  dimensionScores: DimensionSummary[];
}

function isScoringResult(value: unknown): value is ScoringResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ScoringResult).competencies) &&
    Array.isArray((value as ScoringResult).dimensions)
  );
}

/** Every competency + dimension score, on the shared 1-5 scale, averaged
 * and converted to a percentage (5/5 across the board = 100%). Returns
 * null when reportJson isn't a recognizable ScoringResult (not scored yet,
 * or an old/differently-shaped report) — the caller decides what "no
 * verdict yet" means for its own response shape. */
export function computeEligibility(reportJson: unknown): EligibilityResult | null {
  if (!isScoringResult(reportJson)) {
    return null;
  }

  const items: { label: string; score: number; evidence: string }[] = [
    ...reportJson.competencies.map((c) => ({
      label: c.competency,
      score: c.score,
      evidence: c.evidence,
    })),
    ...reportJson.dimensions.map((d) => ({
      label: d.dimension,
      score: d.score,
      evidence: d.evidence,
    })),
  ];

  if (items.length === 0) {
    return {
      overallPercentage: 0,
      eligible: false,
      negativePoints: [],
      dimensionScores: [],
    };
  }

  const overallPercentage = Math.round(
    (items.reduce((sum, item) => sum + item.score, 0) / (items.length * 5)) * 100,
  );

  const negativePoints = items
    .filter((item) => item.score <= NEGATIVE_SCORE_CUTOFF)
    .sort((a, b) => a.score - b.score)
    .map(({ label, score, evidence }) => ({ label, score, evidence }));

  return {
    overallPercentage,
    eligible: overallPercentage >= ELIGIBILITY_THRESHOLD_PERCENT,
    negativePoints,
    dimensionScores: reportJson.dimensions.map((d) => ({
      dimension: d.dimension,
      score: d.score,
    })),
  };
}
