"""Orchestrates post-interview evaluation: competency scoring, interview-
wide dimension scoring, and aggregation into one structured result. No
scoring rubric text lives here (see prompts/competency.py and
prompts/dimensions.py) and no scoring logic either (see
competency_scorer.py, dimension_scorer.py, aggregation.py) — this file only
coordinates the three, and stays small on purpose.

A separate evaluation from agent/interview/answer_analyzer.py's: that one
answers "is the candidate's current answer sufficient to continue the
interview," asked live, mid-conversation, against one question's expected
signals. This one answers "how did the candidate perform across the whole
completed interview," asked once, after the fact, over the entire
transcript. Different jobs, never merged — this module doesn't import
answer_analyzer.py, and never will.

Also a separate scorer from agent/legacy_cli/scorer.py's text-CLI one: that
one scores a transcript already segmented into one turn per question (the
CLI controls the turn structure explicitly). A voice conversation has no
such segmentation, hence competency_scorer.py handing the LLM the whole
transcript per competency instead.
"""

from agent.interview.questions import SelectedQuestion
from agent.scoring.aggregation import aggregate_results
from agent.scoring.competency_scorer import score_competencies
from agent.scoring.dimension_scorer import score_dimensions
from agent.scoring.schemas import ScoringResult


def evaluate_interview(
    transcript: list[dict],
    selected_questions: list[SelectedQuestion],
    role_name: str,
) -> ScoringResult:
    competencies = score_competencies(transcript, selected_questions, role_name)
    dimensions = score_dimensions(transcript, role_name)
    return aggregate_results(role_name, competencies, dimensions)
