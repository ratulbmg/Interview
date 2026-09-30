"""Unit tests for agent/scoring/. Every LLM call is mocked (patching
agent.llm.client.chat_json) — no network access and no running Ollama
instance are needed to run these.

Run from apps/engine, after `python -m pip install pytest` (or `pip install
--group test .` on a toolchain that supports PEP 735 dependency groups —
see pyproject.toml's [dependency-groups]):

    .venv/bin/python -m pytest tests/
"""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from agent.interview.agent_data_client import QuestionRecord
from agent.interview.questions import SelectedQuestion
from agent.scoring import routes as scoring_routes
from agent.scoring.aggregation import aggregate_results
from agent.scoring.competency_scorer import score_competencies
from agent.scoring.dimension_scorer import ALL_DIMENSIONS, score_dimensions
from agent.scoring.evaluator import evaluate_interview
from agent.scoring.schemas import CompetencyScore, DimensionScore, ScoringResult
from agent.scoring.serializers import (
    dtos_from_selected_questions,
    selected_questions_from_dtos,
    transcript_to_text,
)

TRANSCRIPT = [
    {"role": "assistant", "content": "Tell me about your experience with React state management."},
    {"role": "user", "content": "I usually reach for a shared store once two sibling components need the same state."},
    {"role": "assistant", "content": "Can you give a concrete example?"},
    {
        "role": "user",
        "content": "Sure — on my last project I moved cart state into a Zustand store when both the header and checkout page needed it.",
    },
]


def _question(competency: str, slot: str = "core_competency") -> SelectedQuestion:
    return SelectedQuestion(
        slot=slot,
        competency=competency,
        question=QuestionRecord(
            id=1,
            text=f"Tell me about {competency}.",
            competency=competency,
            difficulty="MEDIUM",
            tags=[],
            embedding=None,
            times_asked=0,
            last_asked_at=None,
        ),
    )


def _mock_competency_response(score=4, evidence="I moved cart state into a Zustand store"):
    return {"score": score, "evidence": evidence, "rationale": "Gave a concrete, specific example."}


def _mock_dimensions_response():
    return {
        "dimensions": [
            {
                "dimension": name,
                "score": 4,
                "evidence": "I moved cart state into a Zustand store",
                "rationale": "Clear and specific.",
            }
            for name in ALL_DIMENSIONS
        ]
    }


# --- competency scoring (1, 4, 6) -------------------------------------------


def test_score_competencies_happy_path():
    with patch("agent.llm.client.chat_json", return_value=_mock_competency_response()) as mock_call:
        scores = score_competencies(TRANSCRIPT, [_question("React")], "Frontend Engineer")

    assert mock_call.call_count == 1
    assert len(scores) == 1
    assert scores[0].competency == "React"
    assert scores[0].score == 4
    assert scores[0].evidence
    assert scores[0].rationale


def test_score_competencies_not_covered_scores_one():
    with patch(
        "agent.llm.client.chat_json",
        return_value=_mock_competency_response(score=1, evidence="Not addressed in the transcript."),
    ):
        scores = score_competencies(TRANSCRIPT, [_question("Kubernetes")], "Backend Engineer")

    assert scores[0].score == 1
    assert scores[0].evidence  # still required — a plain note, never empty


def test_score_competencies_deduplicates():
    questions = [_question("React"), _question("React"), _question("JavaScript")]
    with patch("agent.llm.client.chat_json", return_value=_mock_competency_response()) as mock_call:
        scores = score_competencies(TRANSCRIPT, questions, "Frontend Engineer")

    assert mock_call.call_count == 2  # one per DISTINCT competency, not per question
    assert {s.competency for s in scores} == {"React", "JavaScript"}


# --- score validation (3) ----------------------------------------------------


def test_competency_score_rejects_out_of_range():
    with pytest.raises(ValidationError):
        CompetencyScore(competency="React", score=6, evidence="x", rationale="x")
    with pytest.raises(ValidationError):
        CompetencyScore(competency="React", score=0, evidence="x", rationale="x")


def test_dimension_score_rejects_unknown_dimension_name():
    with pytest.raises(ValidationError):
        DimensionScore(dimension="niceness", score=3, evidence="x", rationale="x")


# --- malformed LLM output (5) -------------------------------------------------


def test_score_competencies_raises_on_malformed_llm_output():
    with patch("agent.llm.client.chat_json", return_value={"score": "not-a-number", "evidence": "x"}):
        with pytest.raises(ValueError):
            score_competencies(TRANSCRIPT, [_question("React")], "Frontend Engineer")


def test_score_competencies_raises_on_out_of_range_score_from_llm():
    with patch("agent.llm.client.chat_json", return_value={"score": 7, "evidence": "x", "rationale": "x"}):
        with pytest.raises(ValueError):
            score_competencies(TRANSCRIPT, [_question("React")], "Frontend Engineer")


# --- dimension scoring (2) ----------------------------------------------------


def test_score_dimensions_happy_path():
    with patch("agent.llm.client.chat_json", return_value=_mock_dimensions_response()) as mock_call:
        scores = score_dimensions(TRANSCRIPT, "Frontend Engineer")

    assert mock_call.call_count == 1  # one call covers all seven dimensions
    assert len(scores) == len(ALL_DIMENSIONS)
    assert {s.dimension for s in scores} == set(ALL_DIMENSIONS)
    assert all(1 <= s.score <= 5 for s in scores)


def test_score_dimensions_tolerates_missing_dimension():
    partial = _mock_dimensions_response()
    partial["dimensions"] = partial["dimensions"][:-1]  # drop the last dimension
    with patch("agent.llm.client.chat_json", return_value=partial):
        scores = score_dimensions(TRANSCRIPT, "Frontend Engineer")

    assert len(scores) == len(ALL_DIMENSIONS) - 1


# --- serializer behavior (7) ---------------------------------------------------


def test_transcript_to_text_preserves_both_roles_in_order():
    lines = transcript_to_text(TRANSCRIPT).splitlines()
    assert len(lines) == len(TRANSCRIPT)
    assert lines[0].startswith("assistant:")
    assert lines[1].startswith("user:")


def test_selected_questions_round_trip_preserves_adaptive_metadata():
    original = [_question("React")]
    reconstructed = selected_questions_from_dtos(dtos_from_selected_questions(original))

    assert reconstructed[0].competency == "React"
    assert reconstructed[0].question.id == original[0].question.id
    assert reconstructed[0].question.difficulty == original[0].question.difficulty


# --- evaluator orchestration (8) ------------------------------------------------


def test_evaluate_interview_orchestrates_both_scorers():
    responses = iter([_mock_competency_response(), _mock_dimensions_response()])
    with patch("agent.llm.client.chat_json", side_effect=lambda *a, **k: next(responses)):
        result = evaluate_interview(TRANSCRIPT, [_question("React")], "Frontend Engineer")

    assert isinstance(result, ScoringResult)
    assert result.role == "Frontend Engineer"
    assert len(result.competencies) == 1
    assert len(result.dimensions) == len(ALL_DIMENSIONS)


# --- aggregation behavior (9) -----------------------------------------------------


def test_aggregate_results_has_no_overall_numeric_score():
    competencies = [CompetencyScore(competency="React", score=4, evidence="x", rationale="x")]
    dimensions = [DimensionScore(dimension="communication", score=5, evidence="y", rationale="y")]

    result = aggregate_results("Frontend Engineer", competencies, dimensions)

    assert "overall_score" not in result.model_dump()
    assert result.summary  # a text summary is fine — a number is not


def test_aggregate_results_summary_reflects_tiers_without_averaging():
    competencies = [CompetencyScore(competency="React", score=5, evidence="x", rationale="x")]
    dimensions = [DimensionScore(dimension="communication", score=1, evidence="y", rationale="y")]

    result = aggregate_results("Frontend Engineer", competencies, dimensions)

    assert "React" in result.summary
    assert "communication" in result.summary
    assert "strong" in result.summary.lower()
    assert "not provide sufficient" in result.summary.lower()


# --- /score endpoint (10) -----------------------------------------------------------


@pytest.fixture
def score_client(monkeypatch):
    monkeypatch.setattr(scoring_routes, "AGENT_WEBHOOK_SECRET", "test-secret")
    app = FastAPI()
    app.include_router(scoring_routes.router)
    return TestClient(app)


def _score_request_body():
    return {
        "transcript": TRANSCRIPT,
        "selectedQuestions": [
            {
                "id": 1,
                "slot": "core_competency",
                "competency": "React",
                "questionText": "Tell me about React.",
                "difficulty": "MEDIUM",
                "questionType": "ROLE",
                "objective": "Assess React depth.",
                "expectedSignals": [],
                "maxFollowups": 2,
                "maxDurationSeconds": 180,
            }
        ],
        "roleName": "Frontend Engineer",
    }


def test_score_endpoint_rejects_missing_secret(score_client):
    response = score_client.post("/score", json=_score_request_body())
    assert response.status_code == 401


def test_score_endpoint_returns_structured_report(score_client):
    responses = iter([_mock_competency_response(), _mock_dimensions_response()])
    with patch("agent.llm.client.chat_json", side_effect=lambda *a, **k: next(responses)):
        response = score_client.post(
            "/score",
            json=_score_request_body(),
            headers={"x-agent-webhook-secret": "test-secret"},
        )

    assert response.status_code == 200
    report = response.json()["report"]
    assert report["role"] == "Frontend Engineer"
    assert len(report["competencies"]) == 1
    assert len(report["dimensions"]) == len(ALL_DIMENSIONS)
    assert "overall_score" not in report
