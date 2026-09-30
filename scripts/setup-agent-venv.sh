#!/usr/bin/env bash
# apps/engine's build step (see root package.json's "agent:build",
# wired into turbo.json as the //#agent:build root task).
#
# Idempotent on purpose: re-running `python3 -m venv .venv` on an ALREADY
# EXISTING venv, with a different interpreter than the one that created it,
# silently rewrites that venv's `pip`/`pip3` shebang to the new interpreter
# (while leaving `python3` alone) — turning a correctly-set-up venv into
# one where `pip install` runs under the wrong Python. Only creating it
# once avoids that.
#
# Picks python3.12 over plain python3 when available: kokoro-onnx (an
# installed pipecat-ai extra, see pyproject.toml) doesn't support 3.14 yet.
set -euo pipefail
cd "$(dirname "$0")/../apps/engine"

if [ ! -d .venv ]; then
  if command -v python3.12 >/dev/null 2>&1; then
    python3.12 -m venv .venv
  else
    python3 -m venv .venv
  fi
fi

# `python -m pip`, not `.venv/bin/pip` directly — pip's own script has an
# absolute-path shebang baked in at venv-creation time, which breaks the
# moment this directory is ever renamed or moved (it did, once already:
# apps/interview-engine -> apps/engine). `.venv/bin/python` is a relative
# symlink, so it always resolves correctly regardless of the venv's path.
.venv/bin/python -m pip install -e .
