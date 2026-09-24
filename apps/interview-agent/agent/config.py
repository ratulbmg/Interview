"""Environment configuration.

Not a yarn workspace member, so this doesn't share packages/enums or
packages/db with the TypeScript side — it talks to the same Postgres
database directly (see db.py) and reads the same DATABASE_URL shape.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/interview")

# Text LLM — CV parsing, scoring, and (via agent/interview_loop.py) the
# text-only CLI's follow-ups (see agent/llm_client.py). Points at a local
# Ollama server by default: the `openai` Python SDK works against it
# unmodified since Ollama serves an OpenAI-compatible /v1 API — LLM_API_KEY
# is a dummy value Ollama doesn't check, not a real credential. Point
# LLM_BASE_URL at OpenAI (or any other OpenAI-compatible endpoint) instead
# and set a real LLM_API_KEY to use that instead.
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
LLM_CHAT_MODEL = os.environ.get("LLM_CHAT_MODEL", "qwen2.5:7b-instruct")
# nomic-embed-text is 768-dimensional — packages/db's Question.embedding
# column is sized to match (see packages/db/prisma/schema.prisma). Changing
# this to a model with a different output size needs a matching migration.
LLM_EMBEDDING_MODEL = os.environ.get("LLM_EMBEDDING_MODEL", "nomic-embed-text")

# Voice pipeline (agent/voice/pipeline.py) — separate from the settings
# above because STT/TTS aren't OpenAI-compatible-API concepts the same way
# chat/embeddings are; these configure Pipecat's local Ollama/Whisper/Kokoro
# services directly.
VOICE_LLM_MODEL = os.environ.get("VOICE_LLM_MODEL", LLM_CHAT_MODEL)
VOICE_STT_MODEL = os.environ.get("VOICE_STT_MODEL", "mlx-community/distil-whisper-large-v3")
VOICE_TTS_VOICE = os.environ.get("VOICE_TTS_VOICE", "af_heart")

# Reject a candidate question whose embedding is this cosine-similar to one
# already selected for the same interview — keeps slots from asking
# near-duplicate questions.
SIMILARITY_REJECTION_THRESHOLD = 0.85

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

# apps/api — where the voice pipeline POSTs a finished transcript (Phase 6)
# and fetches nothing else directly (everything else comes straight from
# Postgres, see db.py).
API_URL = os.environ.get("API_URL", "http://localhost:3001")
AGENT_WEBHOOK_SECRET = os.environ.get("AGENT_WEBHOOK_SECRET")

AGENT_HOST = os.environ.get("AGENT_HOST", "0.0.0.0")
AGENT_PORT = int(os.environ.get("AGENT_PORT", "7860"))
