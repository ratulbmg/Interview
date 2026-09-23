"""Posts a finished interview's transcript back to apps/api — the one
piece of interview state this process hands off rather than writing to
Postgres directly (see apps/api/src/routes/webhookRoute.ts), so the API
stays the single place that reacts to a completed interview (Phase 7 adds
scoring there).
"""

import httpx

from agent.config import AGENT_WEBHOOK_SECRET, API_URL


async def post_transcript(session_id: int, transcript: list[dict]) -> None:
    if not AGENT_WEBHOOK_SECRET:
        raise RuntimeError("AGENT_WEBHOOK_SECRET is not set — the API will reject this webhook call without it.")

    url = f"{API_URL}/webhooks/sessions/{session_id}/transcript"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json={"transcript": transcript},
            headers={"X-Agent-Webhook-Secret": AGENT_WEBHOOK_SECRET},
            timeout=30,
        )
        response.raise_for_status()
