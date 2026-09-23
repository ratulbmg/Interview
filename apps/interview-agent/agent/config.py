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
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
OPENAI_EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
# Pipecat's OpenAI voice pipeline (agent/voice/pipeline.py) uses its own
# chat model default (see OpenAILLMService) unless overridden here.
OPENAI_VOICE_CHAT_MODEL = os.environ.get("OPENAI_VOICE_CHAT_MODEL", "gpt-4o-mini")
OPENAI_VOICE_ID = os.environ.get("OPENAI_VOICE_ID", "alloy")

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
