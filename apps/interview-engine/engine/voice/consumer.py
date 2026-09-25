"""Consumes the "engine-jobs" BullMQ queue apps/api's sessionService and
candidateService enqueue three kinds of jobs onto — see
packages/shared-schemas/src/engine-job.schema.json for all three payload
shapes. Python's official `bullmq` package talks to the exact same Redis
queue the TypeScript side uses, so no bridging is needed on either end;
jobs are told apart by BullMQ's own job `name`.

- "cv-parse" (enqueued the moment a candidate is added, not tied to any
  interview): parse the CV into structured JSON and save it to
  Candidate.cvParsedJson, well ahead of any interview being scheduled —
  keeps this slow LLM call out of "engine-start"'s tight lead time.
- "engine-start" (scheduledAt minus 2 minutes): use the candidate's
  already-parsed CV (falling back to parsing inline if a "cv-parse" job
  somehow hasn't finished yet), select this interview's questions (reusing
  question_selector.py from Phase 2), and mark the room ready so
  server.py's `bot()` can accept the candidate's browser connection once
  it arrives.
- "noshow-check" (scheduledAt plus 15 minutes, Phase 8): mark the session
  NO_SHOW if it never actually started.

Concurrency is pinned to 1 (see start_consumer): jobs are drained one at a
time rather than in parallel, so e.g. 20 candidates added back-to-back get
their CVs parsed sequentially instead of hammering the LLM/embedding
servers all at once. This is safe to do without slowing down live
interviews because every blocking call below runs via asyncio.to_thread —
this process's WebRTC-serving event loop stays responsive the whole time
regardless of how long the queue takes to drain.
"""

import asyncio
import tempfile
from datetime import datetime
from pathlib import Path

import httpx
from bullmq import Worker, Job

from engine import db
from engine.config import REDIS_URL
from engine.cv_parser import CandidateProfile, parse_cv
from engine.question_selector import select_questions
from engine.voice.ready_rooms import ReadySession, mark_ready

ENGINE_QUEUE_NAME = "engine-jobs"


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


async def _download_and_parse_cv(cv_url: str) -> CandidateProfile:
    cv_path = await asyncio.to_thread(_download_cv, cv_url)
    try:
        return await asyncio.to_thread(parse_cv, cv_path)
    finally:
        Path(cv_path).unlink(missing_ok=True)


async def _process_cv_parse_job(data: dict) -> None:
    candidate_id = data["candidateId"]
    candidate = db.get_candidate_by_id(candidate_id)
    print(f"engine-jobs: parsing CV for candidate {candidate_id}")
    profile = await _download_and_parse_cv(candidate.cv_url)
    await asyncio.to_thread(db.save_candidate_cv_parsed, candidate_id, profile)
    print(f"engine-jobs: candidate {candidate_id} CV parsed and saved")


async def _process_engine_start_job(data: dict) -> None:
    session_id, candidate_id, role_id = data["sessionId"], data["candidateId"], data["roleId"]
    print(f"engine-jobs: preparing session {session_id} (candidate {candidate_id}, role {role_id})")

    candidate = db.get_candidate_by_id(candidate_id)
    role = db.get_role_by_id(role_id)
    bank = db.get_questions()

    if candidate.cv_parsed_json is not None:
        profile = CandidateProfile(**candidate.cv_parsed_json)
    else:
        # Rare race: the interview got scheduled before the "cv-parse" job
        # (enqueued at candidate-add time) had a chance to run. Parse inline
        # — still off the event loop via asyncio.to_thread, so a candidate
        # connecting right now doesn't get frozen out — and backfill so this
        # isn't repeated if the room gets re-prepared.
        print(f"engine-jobs: session {session_id} — cvParsedJson not ready yet, parsing inline")
        profile = await _download_and_parse_cv(candidate.cv_url)
        await asyncio.to_thread(db.save_candidate_cv_parsed, candidate_id, profile)

    selected = await asyncio.to_thread(select_questions, profile, role, bank)

    mark_ready(
        data["meetingUrl"],
        ReadySession(
            session_id=session_id,
            candidate_id=candidate_id,
            role_id=role_id,
            role_name=role.name,
            candidate_name=candidate.name or candidate.email,
            scheduled_at=datetime.fromisoformat(data["scheduledAt"]),
            selected_questions=selected,
        ),
    )
    print(f"engine-jobs: session {session_id} ready — room ready at {data['meetingUrl']}")


async def _process_noshow_check_job(data: dict) -> None:
    session_id = data["sessionId"]
    became_no_show = db.mark_session_no_show_if_not_started(session_id)
    if became_no_show:
        print(f"engine-jobs: session {session_id} marked NO_SHOW — never started by scheduledAt + 15min")
    else:
        print(f"engine-jobs: session {session_id} no-show check skipped — already started or resolved")


async def _dispatch(job: Job, _token: str) -> None:
    if job.name == "cv-parse":
        await _process_cv_parse_job(job.data)
    elif job.name == "engine-start":
        await _process_engine_start_job(job.data)
    elif job.name == "noshow-check":
        await _process_noshow_check_job(job.data)
    else:
        print(f"engine-jobs: ignoring unknown job name {job.name!r}")


def start_consumer() -> Worker:
    return Worker(ENGINE_QUEUE_NAME, _dispatch, {"connection": REDIS_URL, "concurrency": 1})


if __name__ == "__main__":
    worker = start_consumer()
    asyncio.get_event_loop().run_forever()
