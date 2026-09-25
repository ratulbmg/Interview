"""Deliberately the only thing in this package with no pipecat import.

Importing anything from pipecat — even just its frame dataclasses — runs
pipecat's own package init, which configures its own noisy DEBUG-level
loguru handler as a side effect. configure_logging() has to run before
that happens, which means the module defining it can't import pipecat
either, or the cascade already ran by the time this function is called.
See engine/voice/server.py, which imports and calls this before anything
else.
"""

import sys

from loguru import logger


def configure_logging() -> None:
    logger.remove()
    # sys.stderr, not a print()-based sink writing to stdout: stdout is
    # block-buffered once it's piped to a non-TTY parent process (exactly
    # the case once this runs under scripts/dev.mjs), so lines can sit
    # unflushed for a long time in a long-running server. stderr is
    # line-buffered regardless — the same reason pipecat's own handler
    # (which this overrides — see server.py) uses it too.
    logger.add(
        sys.stderr,
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <7}</level> | <level>{message}</level>",
        colorize=True,
    )
