#!/usr/bin/env bash
# apps/interview-agent's build step (see root package.json's "agent:build",
# wired into turbo.json as the //#agent:build root task).
#
# Idempotent on purpose: re-running `python3 -m venv .venv` on an ALREADY
# EXISTING venv, with a different interpreter than the one that created it,
# silently rewrites that venv's `pip`/`pip3` shebang to the new interpreter
# (while leaving `python3` alone) — turning a correctly-set-up venv into
# one where `pip install` runs under the wrong Python. Only creating it
# once avoids that.
#
# Picks python3.12 over plain python3 when available: kokoro-onnx (the
# local TTS engine, see agent/voice/pipeline.py) doesn't support 3.14 yet,
# and python3.12 is what docker/Dockerfile.agent.* already standardize on.
set -euo pipefail
cd "$(dirname "$0")/../apps/interview-agent"

if [ ! -d .venv ]; then
  if command -v python3.12 >/dev/null 2>&1; then
    python3.12 -m venv .venv
  else
    python3 -m venv .venv
  fi
fi

.venv/bin/pip install -e .
