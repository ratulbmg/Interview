"""Real per-interview usage tracking — how many LLM tokens, STT seconds,
and TTS characters one connection segment actually consumed, plus how long
the pipeline was actually connected for. Reported to apps/api on every
disconnect (see agent/conversation/manager.py) and added to whatever the
session already has there — a drop-and-resume's later segment adds to the
earlier one, never replaces it (see apps/api's
sessionRepository.incrementUsage).

Built on pipecat's own ServiceMetricsObserver (an observer, not a pipeline
processor, so it only watches frames go by — same reasoning as
ConversationLogObserver in logging.py) rather than hand-parsing
MetricsFrame directly. PipelineParams(enable_usage_metrics=True) is what
makes services actually emit the usage events this observer turns into
records — without it, ServiceMetricsObserver has nothing to report.
"""

import time
from dataclasses import dataclass

from pipecat.observers.service_metrics_observer import ServiceMetricsObserver, ServiceUsageKind, ServiceUsageRecord


@dataclass
class SegmentUsage:
    """What one connection segment (from construction to `.finish()`)
    actually consumed — the shape apps/api's disconnectedSchema expects
    under `usage` (see agent/orchestrator_client.py's
    report_disconnected)."""

    llm_prompt_tokens: int = 0
    llm_completion_tokens: int = 0
    stt_audio_seconds: float = 0.0
    tts_characters: int = 0
    interview_seconds: float = 0.0

    def as_dict(self) -> dict:
        return {
            "llmPromptTokens": self.llm_prompt_tokens,
            "llmCompletionTokens": self.llm_completion_tokens,
            "sttAudioSeconds": round(self.stt_audio_seconds, 2),
            "ttsCharacters": self.tts_characters,
            "interviewSeconds": round(self.interview_seconds, 2),
        }


class UsageTracker:
    """One instance per connection segment (one per `_run_interview_bot`
    call). Attach `.observer` to the PipelineWorker's `observers=[...]`,
    then call `.finish()` once the call ends to stamp elapsed wall-clock
    time and get everything this segment consumed."""

    def __init__(self) -> None:
        self._usage = SegmentUsage()
        self._started_at = time.monotonic()
        self.observer = ServiceMetricsObserver()

        @self.observer.event_handler("on_service_usage")
        async def _on_service_usage(observer, record: ServiceUsageRecord) -> None:
            if record.kind == ServiceUsageKind.LLM:
                self._usage.llm_prompt_tokens += record.prompt_tokens or 0
                self._usage.llm_completion_tokens += record.completion_tokens or 0
            elif record.kind == ServiceUsageKind.STT:
                self._usage.stt_audio_seconds += record.audio_seconds or 0
            elif record.kind == ServiceUsageKind.TTS:
                self._usage.tts_characters += record.characters or 0

    def finish(self) -> SegmentUsage:
        self._usage.interview_seconds = time.monotonic() - self._started_at
        return self._usage
