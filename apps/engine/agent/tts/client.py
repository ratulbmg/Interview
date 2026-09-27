"""Thin factory around this agent's configured TTS provider. Provider-specific
details (which service class, base URL, voice) live only here — callers just
get a ready-to-use service instance, so swapping providers later means
editing this one file, not every place a pipeline gets built (or every
"speak one message and end the call" helper — see
agent/conversation/manager.py's _speak_and_end)."""

from pipecat.services.openai.tts import OpenAITTSService

from agent.config import TTS_API_KEY, TTS_BASE_URL, VOICE_TTS_VOICE


def build_tts_service() -> OpenAITTSService:
    return OpenAITTSService(base_url=TTS_BASE_URL, api_key=TTS_API_KEY, settings=OpenAITTSService.Settings(voice=VOICE_TTS_VOICE))
