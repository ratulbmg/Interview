"""Consumes the "agent-jobs" BullMQ queue apps/api's sessionService.sendInvite
enqueues an agent-start job onto (scheduledAt minus 2 minutes — see
packages/shared-schemas/src/agent-job.schema.json for the payload shape).
Python's official `bullmq` package talks to the exact same Redis queue the
TypeScript side uses, so no bridging is needed on either end.

On each job: parse the candidate's CV, select this interview's questions
(reusing question_selector.py from Phase 2), and mark the room ready so
server.py's `bot()` can accept the candidate's browser connection once it
arrives.
"""

import asyncio
import tempfile
from pathlib import Path

import httpx
from bullmq import Worker, Job

from agent import db
from agent.config import REDIS_URL
from agent.cv_parser import parse_cv
from agent.question_selector import select_questions
from agent.voice.ready_rooms import ReadySession, mark_ready

AGENT_QUEUE_NAME = "agent-jobs"


def _download_cv(cv_url: str) -> str:
    """cvUrl points at apps/api's own /uploads static route (see
    candidateService.ts) — fetched here rather than read off local disk,
    since this process doesn't share a filesystem with the API."""
    response = httpx.get(cv_url, timeout=30)
    response.raise_for_status()
    suffix = Path(cv_url).suffix or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(response.content)
        return f.name


async def _process_agent_start_job(job: Job, _token: str) -> None:
    data = job.data
    session_id, candidate_id, role_id = data["sessionId"], data["candidateId"], data["roleId"]
    print(f"agent-jobs: preparing session {session_id} (candidate {candidate_id}, role {role_id})")

    candidate = db.get_candidate_by_id(candidate_id)
    role = db.get_role_by_id(role_id)
    bank = db.get_questions()

    cv_path = _download_cv(candidate.cv_url)
    try:
        profile = parse_cv(cv_path)
    finally:
        Path(cv_path).unlink(missing_ok=True)

    selected = select_questions(profile, role, bank)

    mark_ready(
        data["meetingUrl"],
        ReadySession(
            session_id=session_id,
            candidate_id=candidate_id,
            role_id=role_id,
            role_name=role.name,
            candidate_name=candidate.name or candidate.email,
            selected_questions=selected,
        ),
    )
    print(f"agent-jobs: session {session_id} ready — room ready at {data['meetingUrl']}")


def start_consumer() -> Worker:
    return Worker(AGENT_QUEUE_NAME, _process_agent_start_job, {"connection": REDIS_URL})


if __name__ == "__main__":
    worker = start_consumer()
    asyncio.get_event_loop().run_forever()
