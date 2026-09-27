"""Inserts a deliberate, configurable pause between the bot's own spoken
sentences for a more natural, less robotic cadence — the one gap in this
pipeline's speech, since Kokoro (agent/tts/client.py) takes plain text over
an OpenAI-compatible endpoint with no SSML <break> support, so a pause has
to be a real timed delay inserted into the pipeline rather than markup.

This is a pure speech-timing processor: it never decides interview content,
question sequencing, follow-ups, or when the interview ends (that's the
LLM's job via the system prompt, and apps/api's job for session lifecycle —
see agent/conversation/manager.py's module docstring). Detecting "is this a
brief acknowledgement" is a fixed, deterministic phrase lookup used only to
pick a pause length, not new judgment.

Why this needs its own sentence-boundary detection (i.e. why it can't just
check `text.endswith((".", "!", "?"))` on incoming frames): sitting between
the LLM and TTSService in the pipeline, this processor sees raw, unaggregated
TextFrame chunks as the LLM streams them (single words/tokens, not clean
sentences) — TTSService's own sentence buffering (pipecat.services.tts_
service.TTSService, backed by pipecat.utils.text.simple_text_aggregator.
SimpleTextAggregator) only runs *inside* TTSService itself, after this
processor's position in the pipeline, so there's no earlier point to observe
"a sentence was just aggregated". This processor therefore reuses
SimpleTextAggregator directly — the same class, same lookahead-based
sentence-boundary logic pipecat itself uses (see its docstring: it waits for
a non-whitespace character after sentence-ending punctuation before
confirming a boundary, to tell "$29." apart from "$29. Next") — rather than
duplicating that logic by hand. Once a sentence is confirmed, it's pushed
downstream immediately as an AggregatedTextFrame, a frame type TTSService
already handles by routing straight to synthesis (bypassing its own
character-by-character aggregation, which is exactly what's needed: without
this, TTSService would re-buffer the already-complete sentence and wait for
*another* lookahead character — the first character of the next sentence,
which is exactly what this processor is about to delay — before it would
ever start speaking). Only after pushing a sentence does this processor
sleep, so the bot still starts speaking sentence 1 before sentence 2 is
fully generated; the pause lands as a gap *after* audio for the previous
sentence starts, not before it.

Barge-in safety: pipecat's FrameProcessor (pipecat.processors.frame_
processor) runs two separate asyncio tasks per processor — one that
processes SystemFrame frames (which includes InterruptionFrame) immediately
off its own queue, and one that processes ordinary data/control frames
(TextFrame, EndFrame, ...) off a second queue, serially. This processor's
`asyncio.sleep` for the pause only ever runs while handling a TextFrame, on
the *second* task. When an InterruptionFrame arrives, the base
FrameProcessor.process_frame (called via `super()` below, before this
processor's own logic runs) invokes `_start_interruption()`, which cancels
and recreates that second task outright — so a pending sleep is cancelled
immediately, not waited out, and the InterruptionFrame itself is processed
and forwarded on the unblocked first task without ever queuing behind it.
That is the existing, unmodified mechanism (nothing new is built here); this
processor only needs to (a) never swallow the CancelledError that cancels
its sleep, and (b) reset its own aggregator buffer on InterruptionFrame, the
same way TTSService resets its.
"""

import asyncio
import re

from pipecat.frames.frames import (
    AggregatedTextFrame,
    EndFrame,
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    TextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.utils.text.simple_text_aggregator import SimpleTextAggregator

from agent.conversation.turn_manager import TurnTimingConfig

# Fixed, deterministic lookup — not fuzzy/semantic matching. A sentence
# matches only once punctuation/quoting is stripped and it's case-folded,
# e.g. "Okay,", "Okay.", and "\"Okay\"" all match "okay". Deliberately not
# exhaustive: this only ever affects which pause length follows the
# sentence, never what the bot says.
_ACKNOWLEDGEMENT_PHRASES = {
    "okay",
    "understood",
    "thank you",
    "got it",
    "that's helpful",
    "noted",
}

_STRIP_RE = re.compile(r"^[\s\"'.,!?;:]+|[\s\"'.,!?;:]+$")


def _is_acknowledgement(sentence: str) -> bool:
    normalized = sentence.replace("’", "'").replace("‘", "'").lower()
    normalized = _STRIP_RE.sub("", normalized)
    return normalized in _ACKNOWLEDGEMENT_PHRASES


class ProsodyPacingProcessor(FrameProcessor):
    """Sits between the LLM and the TTS service in the pipeline (see
    agent/conversation/manager.py's build_pipeline). Buffers the LLM's
    streamed text into confirmed sentences using pipecat's own
    SimpleTextAggregator, forwards each sentence to TTS the moment it's
    confirmed, then — when timing.enable_prosody is True — sleeps for a
    short pause (longer after a brief acknowledgement) before letting the
    next sentence through. A pass-through no-op when timing.enable_prosody
    is False.
    """

    def __init__(self, timing: TurnTimingConfig, **kwargs):
        super().__init__(**kwargs)
        self._timing = timing
        # Independent of, and never shared with, TTSService's own internal
        # aggregator — see module docstring.
        self._aggregator = SimpleTextAggregator()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        # Handles StartFrame/InterruptionFrame/CancelFrame/pause-resume
        # bookkeeping. In particular, for InterruptionFrame this is what
        # cancels-and-recreates this processor's own frame-processing task,
        # aborting any pause this processor is mid-sleep on (see module
        # docstring) -- it must run before anything below.
        await super().process_frame(frame, direction)

        if not self._timing.enable_prosody:
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, InterruptionFrame):
            # Mirror SimpleTextAggregator.handle_interruption(): discard
            # whatever partial sentence was buffered rather than let it leak
            # into whatever the bot says after the interruption. Forward the
            # InterruptionFrame itself immediately, never delayed.
            await self._aggregator.handle_interruption()
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, AggregatedTextFrame):
            # Already aggregated upstream (shouldn't normally happen at this
            # point in the pipeline) -- pass through rather than re-aggregate.
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, TextFrame):
            if frame.skip_tts:
                await self.push_frame(frame, direction)
                return
            await self._aggregate_and_pace(frame.text, direction)
            return

        if isinstance(frame, (LLMFullResponseEndFrame, EndFrame)):
            # Flush whatever's left in the buffer (e.g. a final sentence
            # with no confirming lookahead character yet) before the turn
            # actually ends, same as TTSService does for its own aggregator
            # on these frames.
            remaining = await self._aggregator.flush()
            if remaining and remaining.text:
                await self.push_frame(
                    AggregatedTextFrame(remaining.text, remaining.type), direction
                )
            await self.push_frame(frame, direction)
            return

        # Everything else (StartFrame, CancelFrame, LLMFullResponseStartFrame,
        # function-call frames, ...) passes through untouched.
        await self.push_frame(frame, direction)

    async def _aggregate_and_pace(self, text: str, direction: FrameDirection) -> None:
        async for aggregation in self._aggregator.aggregate(text):
            if not aggregation.text:
                continue

            # Forward the confirmed sentence immediately -- the pause below
            # only ever delays the *next* sentence, never this one, so the
            # bot keeps speaking sentence 1 while sentence 2 is still being
            # generated.
            await self.push_frame(AggregatedTextFrame(aggregation.text, aggregation.type), direction)

            pause_ms = (
                self._timing.normal_pause_ms
                if _is_acknowledgement(aggregation.text)
                else self._timing.short_pause_ms
            )
            if pause_ms > 0:
                await asyncio.sleep(pause_ms / 1000)
