#!/usr/bin/env node
// `yarn ollama_up` — starts the native Ollama (if not already running) and
// makes sure the chat model is pulled. Split out from scripts/dev.mjs on
// purpose: yarn dev no longer manages Ollama itself, it only checks that
// this has already been run.
//
// Embeddings (nomic-embed-text) live in a SEPARATE, dedicated Ollama
// instance in Docker instead (see docker-compose.yml's `embeddings`
// service, `yarn docker_up`) — small enough that CPU-only is fine, unlike
// the chat model below, which needs native GPU access.

import { spawn } from "node:child_process";
import http from "node:http";

const MODELS = ["qwen3:30b-a3b"];

function log(line) {
  console.log(`[ollama_up] ${line}`);
}

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitUntil(checkFn, { attempts = 20, delayMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (await checkFn()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
    proc.on("error", reject);
  });
}

async function ensureServerRunning() {
  if (await checkHttp("http://localhost:11434/api/tags")) {
    log("server already running — leaving it alone");
    return;
  }
  log("starting `ollama serve`...");
  spawn("ollama", ["serve"], { detached: true, stdio: "ignore" }).unref();
  const ok = await waitUntil(() => checkHttp("http://localhost:11434/api/tags"));
  if (!ok) {
    log("ERROR: did not come up in time — is Ollama installed? (https://ollama.com)");
    process.exit(1);
  }
  log("server ready");
}

async function ensureModelsPulled() {
  for (const model of MODELS) {
    log(`pulling ${model} (no-op if already present)...`);
    await run("ollama", ["pull", model]);
  }
}

(async () => {
  await ensureServerRunning();
  await ensureModelsPulled();
  log("done — native Ollama is up with the chat model.");
})().catch((error) => {
  log(`ERROR: ${error.message}`);
  process.exit(1);
});
