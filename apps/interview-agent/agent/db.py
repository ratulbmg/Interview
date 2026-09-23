"""Direct Postgres access.

apps/interview-agent isn't a yarn workspace member and doesn't go through
Prisma — it talks to the same database packages/db migrates, using plain
SQL against the table names Prisma's `@@map(...)` gives them (see
packages/db/prisma/schema.prisma).
"""

from dataclasses import dataclass
from datetime import datetime

import psycopg
from pgvector.psycopg import register_vector

from agent.config import DATABASE_URL


@dataclass
class RoleRecord:
    id: int
    name: str
    description: str
    blueprint: list[dict]


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
            raise ValueError(f'No role named "{name}" — check packages/db/src/seed.ts or the dashboard\'s role list.')
        return RoleRecord(id=row[0], name=row[1], description=row[2], blueprint=row[3])


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
                embedding=list(row[5]) if row[5] is not None else None,
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
