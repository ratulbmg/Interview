"""Inbound POST /score — the one thing apps/api calls back into this agent
for, since scoring needs an LLM call only this process has wired up (see
agent/interview/evaluator.py). Mounted onto the pipecat-owned FastAPI app
by agent/voice/server.py (`app.include_router(router)`).

Requires the same shared-secret header this agent sends the API on its
own outbound calls (see agent/orchestrator_client.py / AGENT_WEBHOOK_SECRET) —
here it's apps/api authenticating *itself* to the agent, the one call
that runs in the opposite direction.
"""

import asyncio

from fastapi import APIRouter, Header, HTTPException

from agent.api.schemas import ScoreRequest, ScoreResponse, selected_questions_from_dtos
from agent.config import AGENT_WEBHOOK_SECRET
from agent.interview.evaluator import score_interview

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
async def score_endpoint(body: ScoreRequest, x_agent_webhook_secret: str = Header(None)) -> ScoreResponse:
    if not AGENT_WEBHOOK_SECRET or x_agent_webhook_secret != AGENT_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    selected_questions = selected_questions_from_dtos(body.selectedQuestions)

    # score_interview makes blocking LLM calls (agent/llm/client.py uses
    # the sync client) — offload so it doesn't stall this process's event
    # loop (and every live WebRTC connection it's serving).
    report = await asyncio.to_thread(
        score_interview,
        [turn.model_dump() for turn in body.transcript],
        selected_questions,
        body.roleName,
    )
    return ScoreResponse(report=report)
