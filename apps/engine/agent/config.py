"""Environment configuration.

Not a yarn workspace member, so this doesn't share packages/enums or
packages/db with the TypeScript side. This process has no database
connection of its own at all — every Postgres read/write goes through
apps/api's POST /agent/data route instead (see agent/interview/agent_data_client.py).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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
# actually has an embedding model loaded. Here that's a second, dedicated
# Ollama instance running in Docker (see docker-compose.yml's `embeddings`
# service, brought up by `yarn docker_up`, on :11435 so it never collides
# with the native Ollama instance on :11434 that serves LLM_BASE_URL) —
# nomic-embed-text is small enough that CPU-only Docker is fine for it,
# unlike the chat model, which stays native for GPU access.
EMBEDDING_BASE_URL = os.environ.get("EMBEDDING_BASE_URL", "http://localhost:11435/v1")
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY", LLM_API_KEY)
# nomic-embed-text is 768-dimensional — packages/db's Question.embedding
# column is sized to match (see packages/db/prisma/schema.prisma). Changing
# this to a model with a different output size needs a matching migration.
LLM_EMBEDDING_MODEL = os.environ.get("LLM_EMBEDDING_MODEL", "nomic-embed-text")

# Voice pipeline (agent/voice/pipeline.py). STT and TTS each talk to their
# own OpenAI-compatible server too — separate endpoints from LLM_BASE_URL
# above because they're a different pair of self-hosted Docker containers
# (see docker-compose.yml's stt/tts services, brought up by `yarn
# docker_up`), not Ollama: speaches (faster-whisper) for transcription,
# kokoro-fastapi for speech. Dummy API keys — neither container checks one.
VOICE_LLM_MODEL = os.environ.get("VOICE_LLM_MODEL", LLM_CHAT_MODEL)
STT_BASE_URL = os.environ.get("STT_BASE_URL", "http://localhost:8000/v1")
STT_API_KEY = os.environ.get("STT_API_KEY", "not-needed")
VOICE_STT_MODEL = os.environ.get("VOICE_STT_MODEL", "Systran/faster-whisper-small")
TTS_BASE_URL = os.environ.get("TTS_BASE_URL", "http://localhost:8880/v1")
TTS_API_KEY = os.environ.get("TTS_API_KEY", "not-needed")
# pipecat's OpenAITTSService rejects any voice name outside real OpenAI's
# own list client-side (alloy, nova, onyx, ...) — even Kokoro's own voice
# names like "af_heart" — before the request reaches the container.
# "alloy" passes that check and kokoro-fastapi still returns real
# synthesized audio for it.
VOICE_TTS_VOICE = os.environ.get("VOICE_TTS_VOICE", "alloy")

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

# Speech-cadence tuning for the voice pipeline (agent/conversation/prosody.py,
# agent/conversation/turn_manager.py) — purely about *how* the bot's own
# speech is paced, never about interview content or when it ends. All of
# these are starting points meant to be tuned by ear once live-tested, not
# values derived from any measurement.
#
# Master switch for the pause-insertion processor between LLM and TTS. False
# restores today's behavior exactly (no processor-inserted gaps).
ENABLE_INTERVIEW_PROSODY = os.environ.get("ENABLE_INTERVIEW_PROSODY", "true").lower() == "true"
# Whether the system prompt (agent/interview/prompt.py) tells the LLM it's
# okay to occasionally open a reply with a brief acknowledgement ("Okay,",
# "Understood") — the LLM decides if/when, this only enables the guidance.
ENABLE_ACKNOWLEDGEMENTS = os.environ.get("ENABLE_ACKNOWLEDGEMENTS", "true").lower() == "true"
# Rough ceiling communicated to the LLM for how often it should use one of
# those acknowledgements — a suggested upper bound, not an enforced rate.
ACKNOWLEDGEMENT_PROBABILITY = float(os.environ.get("ACKNOWLEDGEMENT_PROBABILITY", "0.25"))
# Pause inserted after an ordinary sentence boundary in the bot's speech.
SHORT_PAUSE_MS = int(os.environ.get("SHORT_PAUSE_MS", "140"))
# Pause inserted after a sentence that was just a brief acknowledgement
# ("Okay.", "Understood.") — slightly longer, before the bot continues.
NORMAL_PAUSE_MS = int(os.environ.get("NORMAL_PAUSE_MS", "220"))
# Reserved for a coarser pause (e.g. between one question topic and the
# next) — not wired into any processor yet, kept here so it's ready to use
# without another round of plumbing.
LONG_PAUSE_MS = int(os.environ.get("LONG_PAUSE_MS", "400"))
# Real toggle of SileroVADAnalyzer-driven turn detection/barge-in in
# build_pipeline (agent/conversation/manager.py) — False actually removes
# the VAD analyzer, it isn't cosmetic.
ENABLE_BARGE_IN = os.environ.get("ENABLE_BARGE_IN", "true").lower() == "true"
