"""Runtime state for the currently active interview topic (one primary
question, plus whatever follow-ups it's had so far).

Lives only in this process's memory for the lifetime of one live call —
never persisted to Postgres or to apps/api's checkpointJson. A dropped
connection resumes from the transcript alone (see agent/conversation/
manager.py's is_resume handling): the LLM picks the conversation back up
from what was actually said, not from a saved signal-coverage snapshot, so
there's nothing architecturally that needs this to survive past one
process's handling of one call.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class InterviewState:
    current_question_id: int
    current_competency: str
    current_question_type: str
    expected_signals: list[str]
    covered_signals: list[str] = field(default_factory=list)
    missing_signals: list[str] = field(default_factory=list)
    followup_count: int = 0
    topic_started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_answer: str | None = None
    answer_quality: str | None = None
    last_action: str | None = None

    @classmethod
    def for_question(cls, question_id: int, competency: str, question_type: str, expected_signals: list[str]) -> "InterviewState":
        """Starts tracking a fresh topic — call this the moment a new
        primary question is asked, and every time followup_policy.py
        returns NEXT_QUESTION. Before any answer comes in, every expected
        signal is missing by definition."""
        return cls(
            current_question_id=question_id,
            current_competency=competency,
            current_question_type=question_type,
            expected_signals=list(expected_signals),
            missing_signals=list(expected_signals),
        )

    def elapsed_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.topic_started_at).total_seconds()

    def apply_analysis(self, covered_signals: list[str], missing_signals: list[str], answer_quality: str, answer_text: str) -> None:
        """answer_analyzer.py is given this topic's previously-covered
        signals as context and returns the full, already-cumulative
        covered/missing sets for the topic — not just what this one answer
        added — so this just adopts its output directly rather than
        re-merging anything itself."""
        self.covered_signals = covered_signals
        self.missing_signals = missing_signals
        self.last_answer = answer_text
        self.answer_quality = answer_quality

    def record_followup_asked(self) -> None:
        self.followup_count += 1
        self.last_action = "FOLLOW_UP"
