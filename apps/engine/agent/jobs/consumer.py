"""Consumes the "agent-jobs" BullMQ queue apps/api's sessionService and
candidateService enqueue two kinds of jobs onto — see
packages/shared-schemas/src/agent-job.schema.json for both payload shapes.
Python's official `bullmq` package talks to the exact same Redis queue the
TypeScript side uses, so no bridging is needed on either end; jobs are told
apart by BullMQ's own job `name`.

- "cv-parse" (enqueued the moment a candidate is added, not tied to any
  interview): parse the CV into structured JSON and save it to
  Candidate.cvParsedJson, well ahead of any interview being scheduled —
  keeps this slow LLM call out of "agent-start"'s tight lead time.
- "agent-start" (scheduledAt minus 2 minutes): use the candidate's
  already-parsed CV (falling back to parsing inline if a "cv-parse" job
  somehow hasn't finished yet), select this interview's questions (reusing
  agent/interview/questions.py from Phase 2), and report the selection to
  apps/api so it can hand it back out on the candidate's own
  /agent/rooms/join call once their browser actually connects.

The "noshow-check" and "interview-timeout-finalize" job kinds this consumer
used to also handle moved to apps/api itself — it's now the sole owner of
session-lifecycle timing decisions (see agent/voice/server.py's module
docstring), so those jobs are enqueued onto apps/api's own queue instead of
this one.

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
from pathlib import Path

import httpx
from bullmq import Worker, Job

from agent import orchestrator_client
from agent.config import REDIS_URL
from agent.interview import agent_data_client
from agent.interview.cv import CandidateProfile, parse_cv
from agent.interview.questions import select_questions
from agent.scoring.serializers import dtos_from_selected_questions

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


async def _download_and_parse_cv(cv_url: str) -> CandidateProfile:
    cv_path = await asyncio.to_thread(_download_cv, cv_url)
    try:
        return await asyncio.to_thread(parse_cv, cv_path)
    finally:
        Path(cv_path).unlink(missing_ok=True)


async def _process_cv_parse_job(data: dict) -> None:
    candidate_id = data["candidateId"]
    # agent_data_client calls are blocking HTTP requests to apps/api (see
    # agent/interview/agent_data_client.py), not local Postgres queries —
    # off the event loop via asyncio.to_thread like every other blocking
    # call here.
    candidate = await asyncio.to_thread(agent_data_client.get_candidate_by_id, candidate_id)
    print(f"agent-jobs: parsing CV for candidate {candidate_id}")
    profile = await _download_and_parse_cv(candidate.cv_url)
    await asyncio.to_thread(agent_data_client.save_candidate_cv_parsed, candidate_id, profile)
    print(f"agent-jobs: candidate {candidate_id} CV parsed and saved")


async def _process_agent_start_job(data: dict) -> None:
    session_id, candidate_id, role_id, created_by_id = data["sessionId"], data["candidateId"], data["roleId"], data["createdById"]
    print(f"agent-jobs: preparing session {session_id} (candidate {candidate_id}, role {role_id})")

    candidate = await asyncio.to_thread(agent_data_client.get_candidate_by_id, candidate_id)
    role = await asyncio.to_thread(agent_data_client.get_role_by_id, role_id)
    # Only the scheduling recruiter's own question bank — see
    # agent_data_client.get_questions's docstring.
    bank = await asyncio.to_thread(agent_data_client.get_questions, created_by_id)

    if candidate.cv_parsed_json is not None:
        profile = CandidateProfile(**candidate.cv_parsed_json)
    else:
        # Rare race: the interview got scheduled before the "cv-parse" job
        # (enqueued at candidate-add time) had a chance to run. Parse inline
        # — still off the event loop via asyncio.to_thread, so a candidate
        # connecting right now doesn't get frozen out — and backfill so this
        # isn't repeated if the room gets re-prepared.
        print(f"agent-jobs: session {session_id} — cvParsedJson not ready yet, parsing inline")
        profile = await _download_and_parse_cv(candidate.cv_url)
        await asyncio.to_thread(agent_data_client.save_candidate_cv_parsed, candidate_id, profile)

    selected = await asyncio.to_thread(select_questions, profile, role, bank)

    # dtos_from_selected_questions (agent/scoring/serializers.py) is the
    # one place this wire shape is defined — every adaptive field it
    # carries has to survive this round-trip, or the live interview never
    # sees it again (see that module's docstring).
    selected_dicts = dtos_from_selected_questions(selected)
    await orchestrator_client.save_selected_questions(session_id, selected_dicts)
    print(f"agent-jobs: session {session_id} — {len(selected)} questions selected and reported to the API")


async def _dispatch(job: Job, _token: str) -> None:
    if job.name == "cv-parse":
        await _process_cv_parse_job(job.data)
    elif job.name == "agent-start":
        await _process_agent_start_job(job.data)
    else:
        print(f"agent-jobs: ignoring unknown job name {job.name!r}")


def start_consumer() -> Worker:
    return Worker(AGENT_QUEUE_NAME, _dispatch, {"connection": REDIS_URL, "concurrency": 1})


if __name__ == "__main__":
    worker = start_consumer()
    asyncio.get_event_loop().run_forever()
