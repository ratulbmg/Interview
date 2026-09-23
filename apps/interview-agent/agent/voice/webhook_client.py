"""Posts a finished interview's transcript and score report back to
apps/api — the API stores both and enqueues the recruiter's report-ready
email (see apps/api/src/service/sessionService.ts's receiveTranscript,
Phase 7); this process never writes to Postgres for this step, only via
this one HTTP call.
"""

import httpx

from agent.config import AGENT_WEBHOOK_SECRET, API_URL


async def post_transcript(session_id: int, transcript: list[dict], report: dict | None = None) -> None:
    if not AGENT_WEBHOOK_SECRET:
        raise RuntimeError("AGENT_WEBHOOK_SECRET is not set — the API will reject this webhook call without it.")

    url = f"{API_URL}/webhooks/sessions/{session_id}/transcript"
    body: dict = {"transcript": transcript}
    if report is not None:
        body["report"] = report

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=body,
            headers={"X-Agent-Webhook-Secret": AGENT_WEBHOOK_SECRET},
            timeout=30,
        )
        response.raise_for_status()
