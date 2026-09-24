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
# text-only CLI's follow-ups (see agent/llm_client.py). The `openai` SDK
# works unmodified against any OpenAI-compatible /v1 API — Ollama, LM
# Studio's server, llama.cpp's llama-server directly, or real OpenAI with a
# real key. LLM_API_KEY is only checked by servers that enforce one (LM
# Studio/llama-server do; Ollama doesn't care what's there).
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
LLM_CHAT_MODEL = os.environ.get("LLM_CHAT_MODEL", "qwen2.5:7b-instruct")

# Embeddings get their own endpoint on purpose: whatever's serving
# LLM_BASE_URL above may not have an embedding model loaded alongside its
# chat model (e.g. LM Studio's per-model llama-server processes each serve
# just the one model they were started with) — point this at whatever
# actually has an embedding model loaded. Defaults to the same place as
# LLM_BASE_URL when unset, which is correct for Ollama (it can serve both
# from one process) but must be overridden for a setup like LM Studio's.
EMBEDDING_BASE_URL = os.environ.get("EMBEDDING_BASE_URL", LLM_BASE_URL)
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY", LLM_API_KEY)
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
