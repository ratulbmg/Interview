"""Consumes the "agent-jobs" BullMQ queue apps/api's sessionService enqueues
two kinds of jobs onto — see packages/shared-schemas/src/agent-job.schema.json
for both payload shapes. Python's official `bullmq` package talks to the
exact same Redis queue the TypeScript side uses, so no bridging is needed
on either end; jobs are told apart by BullMQ's own job `name`.

- "agent-start" (scheduledAt minus 2 minutes): parse the candidate's CV,
  select this interview's questions (reusing question_selector.py from
  Phase 2), and mark the room ready so server.py's `bot()` can accept the
  candidate's browser connection once it arrives.
- "noshow-check" (scheduledAt plus 15 minutes, Phase 8): mark the session
  NO_SHOW if it never actually started.
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


async def _process_agent_start_job(data: dict) -> None:
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


async def _process_noshow_check_job(data: dict) -> None:
    session_id = data["sessionId"]
    became_no_show = db.mark_session_no_show_if_not_started(session_id)
    if became_no_show:
        print(f"agent-jobs: session {session_id} marked NO_SHOW — never started by scheduledAt + 15min")
    else:
        print(f"agent-jobs: session {session_id} no-show check skipped — already started or resolved")


async def _dispatch(job: Job, _token: str) -> None:
    if job.name == "agent-start":
        await _process_agent_start_job(job.data)
    elif job.name == "noshow-check":
        await _process_noshow_check_job(job.data)
    else:
        print(f"agent-jobs: ignoring unknown job name {job.name!r}")


def start_consumer() -> Worker:
    return Worker(AGENT_QUEUE_NAME, _dispatch, {"connection": REDIS_URL})


if __name__ == "__main__":
    worker = start_consumer()
    asyncio.get_event_loop().run_forever()
