"""apps/engine has no database connection of its own — every function
below is an HTTP call to apps/api's single POST /agent/data route (see
apps/api/src/service/agentDataService.ts), distinguished by an `action`
field, guarded by the same shared secret every other agent<->api call uses
(see agent/orchestrator_client.py). This module used to hold a direct
psycopg connection to Postgres; function names and signatures are kept
identical to that version so agent/jobs/consumer.py, agent/interview/
questions.py, and agent/legacy_cli/cli.py needed no changes beyond this
file, and blocking network calls (not "blocking DB calls" any more, but
still blocking) — see each caller's own asyncio.to_thread usage.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime

import httpx

from agent.config import AGENT_WEBHOOK_SECRET, API_URL
from agent.interview.cv import CandidateProfile

_DEFAULT_TIMEOUT = 15


@dataclass
class RoleRecord:
    id: int
    name: str
    description: str
    blueprint: list[dict]


@dataclass
class CandidateRecord:
    id: int
    email: str
    name: str | None
    cv_url: str
    cv_parsed_json: dict | None


@dataclass
class QuestionRecord:
    id: int
    text: str
    competency: str
    difficulty: str
    tags: list[str]
    embedding: list[float] | None
    times_asked: int
    last_asked_at: datetime | None
    # Adaptive-questioning metadata (see packages/db/prisma/schema.prisma's
    # Question model) — consumed by answer_analyzer.py and
    # followup_policy.py during the live interview. A question created
    # before this metadata existed still has safe defaults at the database
    # level (questionType=ROLE, expectedSignals=[], maxFollowups=2,
    # maxDurationSeconds=180), never a missing/None value here.
    question_type: str = "ROLE"
    objective: str | None = None
    expected_signals: list[str] = field(default_factory=list)
    max_followups: int = 2
    max_duration_seconds: int = 180


def _headers() -> dict:
    if not AGENT_WEBHOOK_SECRET:
        raise RuntimeError("AGENT_WEBHOOK_SECRET is not set — the API will reject this call without it.")
    return {"X-Agent-Webhook-Secret": AGENT_WEBHOOK_SECRET}


def _call(action: str, **params) -> dict:
    """One POST /agent/data call, distinguished by `action` — see
    agentDataService.ts's switch statement for the matching implementation
    of each one. Synchronous (not async) on purpose: this module's callers
    are a mix of async (agent/jobs/consumer.py, wrapping each call in
    asyncio.to_thread the same way it already did for a blocking Postgres
    call) and fully synchronous (agent/legacy_cli/cli.py's plain CLI
    entrypoint) — matching the original psycopg version's sync signatures
    keeps both working without either needing its own variant."""
    url = f"{API_URL}/agent/data"
    with httpx.Client() as client:
        response = client.post(url, json={"action": action, **params}, headers=_headers(), timeout=_DEFAULT_TIMEOUT)
        response.raise_for_status()
        return response.json()["data"]


def get_user_id_by_email(email: str) -> int:
    """Used only by agent/legacy_cli/cli.py, which has no recruiter/session
    context of its own but still needs a recruiter id to scope
    get_questions() to — every other caller (agent-start, via the live
    session's own createdById) already has one."""
    return _call("getUserIdByEmail", email=email)["id"]


def get_role_by_name(name: str, created_by_id: int) -> RoleRecord:
    """Role names are only unique per recruiter now (see
    packages/db/prisma/schema.prisma's Role.createdBy) — used only by
    agent/legacy_cli/cli.py, which has no session context of its own and
    so has to supply the recruiter id explicitly (the live agent-start job
    looks roles up by id instead, never by name)."""
    data = _call("getRoleByName", name=name, createdById=created_by_id)
    return RoleRecord(id=data["id"], name=data["name"], description=data["description"], blueprint=data["blueprint"])


def get_role_by_id(role_id: int) -> RoleRecord:
    data = _call("getRoleById", roleId=role_id)
    return RoleRecord(id=data["id"], name=data["name"], description=data["description"], blueprint=data["blueprint"])


def get_candidate_by_id(candidate_id: int) -> CandidateRecord:
    data = _call("getCandidateById", candidateId=candidate_id)
    return CandidateRecord(
        id=data["id"], email=data["email"], name=data["name"], cv_url=data["cvUrl"], cv_parsed_json=data["cvParsedJson"]
    )


def save_candidate_cv_parsed(candidate_id: int, profile: CandidateProfile) -> None:
    """Called once by _process_cv_parse_job right after upload, and again as
    a backfill if _process_agent_start_job ever has to parse inline (the
    rare race where an interview gets scheduled before the async parse job
    has run) — see agent/jobs/consumer.py."""
    _call("saveCandidateCvParsed", candidateId=candidate_id, cvParsedJson=asdict(profile))


def get_questions(created_by_id: int) -> list[QuestionRecord]:
    """Each recruiter has their own question bank — this only ever returns
    questions that recruiter added (see packages/db/prisma/schema.prisma's
    Question.createdBy), never the full cross-recruiter table."""
    data = _call("getQuestions", createdById=created_by_id)
    return [
        QuestionRecord(
            id=q["id"],
            text=q["text"],
            competency=q["competency"],
            difficulty=q["difficulty"],
            tags=q["tags"] or [],
            embedding=q["embedding"],
            times_asked=q["timesAsked"],
            last_asked_at=datetime.fromisoformat(q["lastAskedAt"]) if q["lastAskedAt"] else None,
            # .get(...) with the dataclass's own defaults, defensively —
            # the database always provides these now (see schema.prisma),
            # but a rolling deploy could briefly have apps/api on an older
            # response shape while this process already expects the new
            # one; safe defaults over a crash either way.
            question_type=q.get("questionType", "ROLE"),
            objective=q.get("objective"),
            expected_signals=q.get("expectedSignals") or [],
            max_followups=q.get("maxFollowups", 2),
            max_duration_seconds=q.get("maxDurationSeconds", 180),
        )
        for q in data["questions"]
    ]


def save_question_embedding(question_id: int, embedding: list[float]) -> None:
    """Lazily backfills an embedding computed on the fly (seed.ts doesn't
    call the embedding API, so the bank starts with no embeddings set)."""
    _call("saveQuestionEmbedding", questionId=question_id, embedding=embedding)


def mark_questions_asked(question_ids: list[int]) -> None:
    if not question_ids:
        return
    _call("markQuestionsAsked", questionIds=question_ids)
