"""Fills each slot in a role's blueprint with one question from the shared
bank: filter by competency + difficulty, drop near-duplicates of what's
already been picked for this interview, rank what's left by relevance to
the candidate's CV, then pick with weighted randomness favoring
less-used questions — so phrasing varies across candidates even though the
competencies tested (the blueprint) don't.
"""

import random
from dataclasses import dataclass

import numpy as np

from engine import db, llm_client
from engine.config import SIMILARITY_REJECTION_THRESHOLD
from engine.cv_parser import CandidateProfile
from engine.db import QuestionRecord, RoleRecord

# How many of the top CV-relevance matches to weighted-sample from, once a
# slot's competency+difficulty filtering has narrowed the field.
RELEVANCE_POOL_SIZE = 3

SENIORITY_TO_DIFFICULTY = {"junior": "EASY", "mid": "MEDIUM", "senior": "HARD"}


@dataclass
class SelectedQuestion:
    slot: str
    competency: str
    question: QuestionRecord


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr, b_arr = np.array(a), np.array(b)
    denom = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    return float(np.dot(a_arr, b_arr) / denom) if denom else 0.0


def _embedding_for(question: QuestionRecord) -> list[float]:
    """Questions seeded via packages/db/src/seed.ts have no embedding yet
    (seeding doesn't call the embeddings API) — compute and persist one the
    first time a question is considered."""
    if question.embedding is not None:
        return question.embedding
    embedding = llm_client.embed(question.text)
    db.save_question_embedding(question.id, embedding)
    question.embedding = embedding
    return embedding


def _slot_competency(slot: dict) -> str:
    """'core_competency' slots name a specific skill in `competency`; every
    other slot type (opener, cv_probe, scenario, behavioral,
    candidate_questions) uses its own slot name as the competency tag —
    see packages/db/src/seed.ts's header comment."""
    return slot.get("competency", slot["slot"])


def select_questions(profile: CandidateProfile, role: RoleRecord, bank: list[QuestionRecord]) -> list[SelectedQuestion]:
    cv_embedding = llm_client.embed(profile.summary_text())
    target_difficulty = SENIORITY_TO_DIFFICULTY[profile.seniority_signal]

    selected: list[SelectedQuestion] = []
    selected_embeddings: list[list[float]] = []
    used_ids: set[int] = set()

    for slot in role.blueprint:
        competency = _slot_competency(slot)
        candidates = [q for q in bank if q.competency == competency and q.id not in used_ids]
        if not candidates:
            raise ValueError(
                f'No question in the bank has competency "{competency}" (needed for role '
                f'"{role.name}"\'s "{slot["slot"]}" slot) — add one via packages/db/src/seed.ts.'
            )

        # Prefer the candidate's inferred difficulty; fall back to the full
        # competency-matched set rather than leaving the slot unfilled.
        by_difficulty = [q for q in candidates if q.difficulty == target_difficulty]
        pool = by_difficulty or candidates

        # Drop anything too similar to a question already picked for this
        # interview, so slots don't end up asking near-duplicates.
        not_too_similar = [
            q for q in pool if all(_cosine_similarity(_embedding_for(q), sel) < SIMILARITY_REJECTION_THRESHOLD for sel in selected_embeddings)
        ]
        pool = not_too_similar or pool

        ranked = sorted(pool, key=lambda q: _cosine_similarity(_embedding_for(q), cv_embedding), reverse=True)
        top_pool = ranked[:RELEVANCE_POOL_SIZE]

        weights = [1 / (1 + q.times_asked) for q in top_pool]
        chosen = random.choices(top_pool, weights=weights, k=1)[0]

        selected.append(SelectedQuestion(slot=slot["slot"], competency=competency, question=chosen))
        selected_embeddings.append(_embedding_for(chosen))
        used_ids.add(chosen.id)

    return selected
