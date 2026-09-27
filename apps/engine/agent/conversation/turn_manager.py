"""Typed view of the speech-cadence knobs in agent/config.py, handed to
agent/conversation/prosody.py's ProsodyPacingProcessor.

A dataclass rather than reading agent.config directly from prosody.py so
the processor's dependency is explicit and the whole timing surface it
actually cares about is visible in one place (and easy to override in a
test without monkeypatching env-derived globals).
"""

from dataclasses import dataclass

from agent import config


@dataclass(frozen=True)
class TurnTimingConfig:
    """Pause durations and feature toggles for the bot's own speech cadence.

    long_pause_ms is carried through from config but not used by
    ProsodyPacingProcessor today -- it's reserved for a coarser pause (e.g.
    between one question topic and the next) that nothing currently
    triggers; see agent/config.py's LONG_PAUSE_MS comment.
    """

    short_pause_ms: int
    normal_pause_ms: int
    long_pause_ms: int
    enable_prosody: bool
    enable_barge_in: bool


def load_turn_timing_config() -> TurnTimingConfig:
    return TurnTimingConfig(
        short_pause_ms=config.SHORT_PAUSE_MS,
        normal_pause_ms=config.NORMAL_PAUSE_MS,
        long_pause_ms=config.LONG_PAUSE_MS,
        enable_prosody=config.ENABLE_INTERVIEW_PROSODY,
        enable_barge_in=config.ENABLE_BARGE_IN,
    )
