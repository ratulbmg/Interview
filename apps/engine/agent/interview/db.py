"""Direct Postgres access.

apps/engine isn't a yarn workspace member and doesn't go through
Prisma — it talks to the same database packages/db migrates, using plain
SQL against the table names Prisma's `@@map(...)` gives them (see
packages/db/prisma/schema.prisma).
"""

from dataclasses import asdict, dataclass
from datetime import datetime

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Json

from agent.config import DATABASE_URL
from agent.interview.cv import CandidateProfile


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


def _connect() -> psycopg.Connection:
    conn = psycopg.connect(DATABASE_URL)
    register_vector(conn)
    return conn


def get_role_by_name(name: str) -> RoleRecord:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute('SELECT id, name, description, blueprint FROM roles WHERE name = %s', (name,))
        row = cur.fetchone()
        if row is None:
            raise ValueError(f'No role named "{name}" — check packages/db/src/seed.ts or the admin app\'s role list.')
        return RoleRecord(id=row[0], name=row[1], description=row[2], blueprint=row[3])


def get_role_by_id(role_id: int) -> RoleRecord:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, name, description, blueprint FROM roles WHERE id = %s", (role_id,))
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"No role with id {role_id}.")
        return RoleRecord(id=row[0], name=row[1], description=row[2], blueprint=row[3])


def get_candidate_by_id(candidate_id: int) -> CandidateRecord:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute('SELECT id, email, name, "cvUrl", "cvParsedJson" FROM candidates WHERE id = %s', (candidate_id,))
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"No candidate with id {candidate_id}.")
        return CandidateRecord(id=row[0], email=row[1], name=row[2], cv_url=row[3], cv_parsed_json=row[4])


def save_candidate_cv_parsed(candidate_id: int, profile: CandidateProfile) -> None:
    """Called once by _process_cv_parse_job right after upload, and again as
    a backfill if _process_engine_start_job ever has to parse inline (the
    rare race where an interview gets scheduled before the async parse job
    has run) — see agent/jobs/consumer.py."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            'UPDATE candidates SET "cvParsedJson" = %s WHERE id = %s',
            (Json(asdict(profile)), candidate_id),
        )
        conn.commit()


def get_questions() -> list[QuestionRecord]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            'SELECT id, text, competency, difficulty, tags, embedding, "timesAsked", "lastAskedAt" FROM questions'
        )
        return [
            QuestionRecord(
                id=row[0],
                text=row[1],
                competency=row[2],
                difficulty=row[3],
                tags=row[4] or [],
                embedding=row[5].to_list() if row[5] is not None else None,
                times_asked=row[6],
                last_asked_at=row[7],
            )
            for row in cur.fetchall()
        ]


def save_question_embedding(question_id: int, embedding: list[float]) -> None:
    """Lazily backfills an embedding computed on the fly (seed.ts doesn't
    call the embedding API, so the bank starts with no embeddings set)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("UPDATE questions SET embedding = %s WHERE id = %s", (embedding, question_id))
        conn.commit()


def mark_questions_asked(question_ids: list[int]) -> None:
    if not question_ids:
        return
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            'UPDATE questions SET "timesAsked" = "timesAsked" + 1, "lastAskedAt" = now() WHERE id = ANY(%s)',
            (question_ids,),
        )
        conn.commit()
