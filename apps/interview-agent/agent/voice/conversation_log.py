"""Clean, human-readable conversation logging for the voice pipeline.

Pipecat's own logging is DEBUG-level and frame-by-frame (SDP/ICE
negotiation, processor linking, per-chunk TTS calls) — useful for
debugging the pipeline itself, but unreadable as a live transcript. See
agent/log_setup.py for the loguru handler that keeps that noise out of the
terminal; ConversationLogObserver here adds exactly the three lines worth
watching live: what the candidate said, when the LLM starts working on a
reply, and what the interviewer says back.
"""

from loguru import logger

from pipecat.frames.frames import LLMFullResponseStartFrame, TranscriptionFrame, TTSTextFrame
from pipecat.observers.base_observer import BaseObserver, FramePushed


class ConversationLogObserver(BaseObserver):
    """Attached per-call in server.py's _run_interview_bot. An observer
    (not a pipeline processor) so it only watches frames go by — it can't
    accidentally change what the pipeline does."""

    def __init__(self) -> None:
        super().__init__()
        self._announced_processing = False

    async def on_push_frame(self, data: FramePushed) -> None:
        frame = data.frame

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            logger.info(f"Candidate:   {frame.text.strip()}")
            self._announced_processing = False

        elif isinstance(frame, LLMFullResponseStartFrame) and not self._announced_processing:
            logger.info("Processing response...")
            self._announced_processing = True

        elif isinstance(frame, TTSTextFrame) and frame.text.strip():
            logger.info(f"Interviewer: {frame.text.strip()}")
