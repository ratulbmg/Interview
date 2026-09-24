"""Thin wrapper around the OpenAI client — every LLM call in this package
goes through one of the two functions here, so there's a single place that
knows about the endpoint, model names, and response-format details.

Points at a local Ollama server by default (see agent/config.py) — the
`openai` SDK works against it unmodified since Ollama serves an
OpenAI-compatible /v1 API. Point LLM_BASE_URL at OpenAI (or any other
OpenAI-compatible endpoint) with a real LLM_API_KEY to use that instead.
"""

import json

from openai import OpenAI

from agent.config import LLM_API_KEY, LLM_BASE_URL, LLM_CHAT_MODEL, LLM_EMBEDDING_MODEL

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _client


def chat_json(system_prompt: str, user_prompt: str) -> dict:
    """A chat completion constrained to return a single JSON object."""
    response = _get_client().chat.completions.create(
        model=LLM_CHAT_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content
    return json.loads(content) if content else {}


def chat_text(system_prompt: str, user_prompt: str) -> str:
    response = _get_client().chat.completions.create(
        model=LLM_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def embed(text: str) -> list[float]:
    response = _get_client().embeddings.create(model=LLM_EMBEDDING_MODEL, input=text)
    return response.data[0].embedding
