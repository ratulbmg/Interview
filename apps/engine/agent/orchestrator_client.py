"""HTTP client for apps/api's engine-facing endpoints.

This is the other half of the inversion described in agent/voice/server.py's
module docstring: apps/api is now "the orchestrator" for every session-lifecycle
decision (is this candidate too early, has the link expired, is this a fresh
start or a resume, what should the bot say) — this process just asks it what
to do (`join`) and reports what happened (`save_selected_questions`,
`report_consent_given`, `report_disconnected`). The only thing still decided
here is scoring (see agent/scoring/evaluator.py and the /score route in
agent/scoring/routes.py), because only this process has the LLM client wired
up.

Same shared-secret header apps/api's old webhook route (see the now-deleted
agent/voice/webhook_client.py) used to authenticate calls FROM this agent
TO the API — reused unchanged here for the same direction, and required of
the API when it calls back into this agent's own /score route.
"""

import httpx

from agent.config import API_URL, AGENT_WEBHOOK_SECRET

# Generous timeout for calls the API may need a moment to think about
# (join, in particular, may itself do DB work) but that are otherwise
# ordinary request/response calls — nothing here does an LLM call.
_DEFAULT_TIMEOUT = 15


def _headers() -> dict:
    if not AGENT_WEBHOOK_SECRET:
        raise RuntimeError("AGENT_WEBHOOK_SECRET is not set — the API will reject this call without it.")
    return {"X-Agent-Webhook-Secret": AGENT_WEBHOOK_SECRET}


async def join(room_token: str) -> dict:
    """Asks apps/api what to do for this room token — the single decision
    point that replaced this agent's own Postgres-backed "too early /
    expired / already completed / fresh start / resume" logic. apps/api
    wraps every response in its standard {success, data, message,
    statusCode} envelope (see ApiResponse on that side) — this unwraps
    "data" so the caller (server.py's bot()) can branch on the instruction's
    "action" field directly instead of every call site needing to know
    about the envelope."""
    url = f"{API_URL}/agent/rooms/join"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json={"roomToken": room_token}, headers=_headers(), timeout=_DEFAULT_TIMEOUT)
        response.raise_for_status()
        return response.json()["data"]


async def save_selected_questions(session_id: int, selected_questions: list[dict]) -> None:
    """Called right after consumer.py's agent-start job picks this
    interview's questions — replaces the old in-memory mark_ready(...)
    registration (ready_rooms.py no longer holds business data, only a
    live-connection counter)."""
    url = f"{API_URL}/agent/sessions/{session_id}/questions-selected"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json={"selectedQuestions": selected_questions}, headers=_headers(), timeout=_DEFAULT_TIMEOUT)
        response.raise_for_status()


async def report_consent_given(session_id: int) -> None:
    """Called once the candidate has heard and responded to the
    recording/AI-evaluation notice — replaces the old db.log_consent call."""
    url = f"{API_URL}/agent/sessions/{session_id}/consent-given"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=_headers(), timeout=_DEFAULT_TIMEOUT)
        response.raise_for_status()


async def report_disconnected(
    session_id: int,
    transcript: list[dict],
    selected_questions: list[dict],
    ended_deliberately: bool,
    usage: dict | None = None,
) -> None:
    """Called on every disconnect — replaces the old local
    checkpoint-or-finalize logic entirely. The API decides what a
    disconnect means (checkpoint and allow resume vs. score and finalize);
    this agent doesn't need to know which.

    `usage` (see agent/conversation/usage_tracking.py's SegmentUsage) is
    what this one connection segment actually consumed — the API adds it
    to whatever the session already has, never overwrites, so a
    drop-and-resume's later segment doesn't erase an earlier one's usage."""
    url = f"{API_URL}/agent/sessions/{session_id}/disconnected"
    body = {
        "transcript": transcript,
        "selectedQuestions": selected_questions,
        "endedDeliberately": ended_deliberately,
        "usage": usage,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=body, headers=_headers(), timeout=_DEFAULT_TIMEOUT)
        response.raise_for_status()
