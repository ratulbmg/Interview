"""Thin wrapper around the OpenAI client — every LLM call in this package
goes through one of the three functions here, so there's a single place
that knows about endpoints, model names, and response-format details.

Chat and embeddings can point at different servers (see agent/config.py's
EMBEDDING_BASE_URL) since whatever's serving chat may not have an
embedding model loaded — e.g. LM Studio's per-model llama-server processes
only serve the one model they were started with.
"""

import json

from openai import OpenAI

from agent.config import EMBEDDING_API_KEY, EMBEDDING_BASE_URL, LLM_API_KEY, LLM_BASE_URL, LLM_CHAT_MODEL, LLM_EMBEDDING_MODEL

_chat_client: OpenAI | None = None
_embedding_client: OpenAI | None = None


def _get_chat_client() -> OpenAI:
    global _chat_client
    if _chat_client is None:
        _chat_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _chat_client


def _get_embedding_client() -> OpenAI:
    global _embedding_client
    if EMBEDDING_BASE_URL == LLM_BASE_URL and EMBEDDING_API_KEY == LLM_API_KEY:
        return _get_chat_client()
    if _embedding_client is None:
        _embedding_client = OpenAI(api_key=EMBEDDING_API_KEY, base_url=EMBEDDING_BASE_URL)
    return _embedding_client


def chat_json(system_prompt: str, user_prompt: str) -> dict:
    """A chat completion constrained to return a single JSON object."""
    response = _get_chat_client().chat.completions.create(
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
    response = _get_chat_client().chat.completions.create(
        model=LLM_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def embed(text: str) -> list[float]:
    response = _get_embedding_client().embeddings.create(model=LLM_EMBEDDING_MODEL, input=text)
    return response.data[0].embedding
