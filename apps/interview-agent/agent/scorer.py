"""Scores a completed transcript against a fixed rubric: one score per
competency (one per blueprint slot actually asked), each required to cite
a verbatim quote from the candidate's own answer as evidence.
"""

from agent import llm_client

RUBRIC_SYSTEM_PROMPT = """You are scoring one segment of a technical interview transcript for a single competency.
Score the candidate's response on a 1-5 scale (1 = did not demonstrate the competency at all,
5 = expert-level demonstration). You MUST quote a short, verbatim piece of the candidate's own
answer text as evidence — copy it exactly, don't paraphrase.
Return a JSON object: {"score": <1-5 integer>, "evidence": "<verbatim quote>"}."""


def _turn_answer_text(turn: dict) -> str:
    parts = [turn["answer"]] + [f["answer"] for f in turn.get("follow_ups", [])]
    return "\n".join(p for p in parts if p)


def score_transcript(transcript: list[dict], role_name: str) -> dict:
    scores = []

    for turn in transcript:
        answer_text = _turn_answer_text(turn)
        result = llm_client.chat_json(
            RUBRIC_SYSTEM_PROMPT,
            f"Competency: {turn['competency']}\nQuestion: {turn['question']}\nCandidate's answer(s):\n{answer_text}",
        )
        scores.append(
            {
                "slot": turn["slot"],
                "competency": turn["competency"],
                "score": int(result.get("score", 0)),
                "evidence": result.get("evidence", ""),
            }
        )

    return {"role": role_name, "scores": scores}
