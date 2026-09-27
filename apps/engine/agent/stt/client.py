"""Thin factory around this agent's configured STT provider. Provider-specific
details (which service class, base URL, model) live only here — callers just
get a ready-to-use service instance, so swapping providers later means
editing this one file, not every place a pipeline gets built."""

from pipecat.services.openai.stt import OpenAISTTService

from agent.config import STT_API_KEY, STT_BASE_URL, VOICE_STT_MODEL


def build_stt_service() -> OpenAISTTService:
    return OpenAISTTService(base_url=STT_BASE_URL, api_key=STT_API_KEY, settings=OpenAISTTService.Settings(model=VOICE_STT_MODEL))
