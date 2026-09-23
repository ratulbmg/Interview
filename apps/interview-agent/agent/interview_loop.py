"""Runs the actual Q&A: ask each selected slot's question in the terminal,
take a typed answer, generate 1-2 live follow-ups from what the candidate
actually said, ask those too, then move to the next slot.
"""

from agent import llm_client
from agent.question_selector import SelectedQuestion

FOLLOW_UP_SYSTEM_PROMPT = """You are an interviewer conducting a live technical interview.
Given the question just asked and the candidate's answer, write 1 or 2 short, natural follow-up
questions that probe deeper into what they actually said (ask for specifics, trade-offs, or
a detail they glossed over). Return a JSON object: {"follow_ups": ["...", "..."]}.
If the answer already fully covers the topic, return an empty list."""


def _generate_follow_ups(question: str, answer: str) -> list[str]:
    result = llm_client.chat_json(
        FOLLOW_UP_SYSTEM_PROMPT,
        f"Question: {question}\nCandidate's answer: {answer}",
    )
    follow_ups = result.get("follow_ups", [])
    return [f for f in follow_ups if isinstance(f, str) and f.strip()][:2]


def run_interview(selected: list[SelectedQuestion]) -> list[dict]:
    transcript = []

    for item in selected:
        print(f"\n--- {item.slot} ({item.competency}) ---")
        print(item.question.text)
        answer = input("> ")

        turn = {
            "slot": item.slot,
            "competency": item.competency,
            "question_id": item.question.id,
            "question": item.question.text,
            "answer": answer,
            "follow_ups": [],
        }

        for follow_up_question in _generate_follow_ups(item.question.text, answer):
            print(follow_up_question)
            follow_up_answer = input("> ")
            turn["follow_ups"].append({"question": follow_up_question, "answer": follow_up_answer})

        transcript.append(turn)

    return transcript
