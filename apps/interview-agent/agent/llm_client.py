"""Thin wrapper around the OpenAI client — every LLM call in this package
goes through one of the two functions here, so there's a single place that
knows about API keys, model names, and response-format details.
"""

import json

from openai import OpenAI

from agent.config import OPENAI_API_KEY, OPENAI_CHAT_MODEL, OPENAI_EMBEDDING_MODEL

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. CV parsing, live follow-ups, and scoring all "
            "need it — copy apps/interview-agent/.env.example to .env and fill it in."
        )
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def chat_json(system_prompt: str, user_prompt: str) -> dict:
    """A chat completion constrained to return a single JSON object."""
    response = _get_client().chat.completions.create(
        model=OPENAI_CHAT_MODEL,
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
        model=OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def embed(text: str) -> list[float]:
    response = _get_client().embeddings.create(model=OPENAI_EMBEDDING_MODEL, input=text)
    return response.data[0].embedding
