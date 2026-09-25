#!/usr/bin/env node
// `yarn ollama_down` — stops Ollama completely, regardless of whether it was
// started as a bare `ollama serve` process (e.g. by ollama-up.mjs) or via
// the Ollama.app menu-bar app (which will otherwise just respawn the
// `ollama serve` subprocess if only that subprocess is killed).

import { spawn } from "node:child_process";

function log(line) {
  console.log(`[ollama_down] ${line}`);
}

function run(command, args) {
  return new Promise((resolve) => {
    // Non-fatal either way — a "no matching process" exit code from pkill
    // just means that particular form wasn't running.
    const proc = spawn(command, args, { stdio: "ignore" });
    proc.on("exit", () => resolve());
    proc.on("error", () => resolve());
  });
}

(async () => {
  log("stopping `ollama serve` process, if any...");
  await run("pkill", ["-f", "ollama serve"]);
  log("stopping the Ollama.app, if running...");
  await run("killall", ["Ollama"]);
  log("done.");
})();
