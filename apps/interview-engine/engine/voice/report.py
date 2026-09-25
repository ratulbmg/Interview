"""Scores a finished voice interview: one 1-5 score per competency asked
(from the session's selected questions, see question_selector.py), each
required to cite a verbatim quote from the transcript as evidence.

A separate scorer from engine/scorer.py's text-CLI one (Phase 2): that one
scores a transcript already segmented into one turn per question (the CLI
controls the turn structure explicitly). A voice conversation has no such
segmentation — the LLM interviewer asks follow-ups and moves between
questions on its own — so this scorer hands the LLM the whole transcript
per competency and asks it to find the relevant part itself.
"""

from engine import llm_client
from engine.question_selector import SelectedQuestion

RUBRIC_SYSTEM_PROMPT = """You are scoring a recorded job interview transcript for ONE specific competency.
Read the full transcript and find where the candidate addressed this competency (it may span more than
one exchange, including follow-up questions). Score their demonstration of it on a 1-5 scale (1 = did not
demonstrate the competency at all, 5 = expert-level demonstration). You MUST quote a short, verbatim piece
of the candidate's own words as evidence — copy it exactly, don't paraphrase. If the transcript never
actually touches this competency, score it 1 and say so in the evidence field.
Return a JSON object: {"score": <1-5 integer>, "evidence": "<verbatim quote or note that it wasn't covered>"}."""


def _transcript_text(transcript: list[dict]) -> str:
    return "\n".join(f"{turn.get('role', '?')}: {turn.get('content', '')}" for turn in transcript)


def score_interview(transcript: list[dict], selected_questions: list[SelectedQuestion], role_name: str) -> dict:
    transcript_text = _transcript_text(transcript)
    # One score per distinct competency actually asked, not one per
    # question — a role's blueprint can ask the same competency's slot
    # only once each in this product (see seed.ts), so this is naturally
    # already deduplicated, but de-dupe defensively rather than assume it.
    seen: set[str] = set()
    scores = []

    for item in selected_questions:
        if item.competency in seen:
            continue
        seen.add(item.competency)

        result = llm_client.chat_json(
            RUBRIC_SYSTEM_PROMPT,
            f"Competency: {item.competency}\n\nFull transcript:\n{transcript_text}",
        )
        scores.append(
            {
                "slot": item.slot,
                "competency": item.competency,
                "score": int(result.get("score", 0)),
                "evidence": result.get("evidence", ""),
            }
        )

    return {"role": role_name, "scores": scores}
