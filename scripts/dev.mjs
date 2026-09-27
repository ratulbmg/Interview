#!/usr/bin/env node
// Starts the native app processes for local dev: `yarn dev` / `npm run dev`.
//
// Ollama and the Docker appliances (Redis, Mailpit, STT, TTS) are each
// started by their own explicit command instead — `yarn ollama_up` and
// `yarn docker_up`, run once before this. This script only checks they're
// already reachable (failing fast with which command to run if not), then
// starts the Python voice agent (not a yarn workspace member, so it's
// spawned here instead of needing its own terminal) alongside the
// TypeScript apps via turbo.
//
// Ctrl+C stops exactly what this script itself started (the agent + turbo)
// — it never touches Ollama or the Docker appliances, since it never
// started them.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_DIR = path.join(ROOT, "apps/engine");

// Only ever holds things this script actually spawned — a service that
// was already running is never added here, so shutdown() never touches it.
const children = []; // { name, proc }

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function log(name, line) {
  console.log(`\x1b[36m[${timestamp()}] [${name}]\x1b[0m ${line}`);
}

function pipeOutput(name, proc) {
  const forward = (chunk, isErr) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.length === 0) continue;
      (isErr ? process.stderr : process.stdout).write(`[${name}] ${line}\n`);
    }
  };
  proc.stdout?.on("data", (chunk) => forward(chunk, false));
  proc.stderr?.on("data", (chunk) => forward(chunk, true));
}

function spawnManaged(name, command, args, opts = {}) {
  const proc = spawn(command, args, {
    detached: true, // own process group, so a Ctrl+C in this terminal
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"], // doesn't also hit these directly — shutdown() decides when
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
  });
  if (!opts.inherit) pipeOutput(name, proc);
  proc.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      log(name, `exited unexpectedly (code ${code}, signal ${signal})`);
    }
  });
  children.push({ name, proc });
  return proc;
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

function checkTcp(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Ollama, Redis, and Mailpit are no longer started here — each is brought
// up by its own explicit command (`yarn ollama_up` / `yarn docker_up`) run
// before `yarn dev`. This just verifies they're actually up and fails fast
// with the right command to run otherwise, rather than silently starting
// them itself.
async function ensureOllama() {
  if (await checkHttp("http://localhost:11434/api/tags")) {
    log("ollama", "already running — leaving it alone");
    return;
  }
  log("ollama", "ERROR: not reachable on :11434 — run `yarn ollama_up` first.");
  process.exit(1);
}

async function ensureRedis() {
  if (await checkTcp(6379)) {
    log("redis", "already running — leaving it alone");
    return;
  }
  log("redis", "ERROR: not reachable on :6379 — run `yarn docker_up` first.");
  process.exit(1);
}

async function ensureMailpit() {
  if (await checkTcp(1025)) {
    log("mailpit", "already running — leaving it alone");
    return;
  }
  log("mailpit", "ERROR: not reachable on :1025 — run `yarn docker_up` first.");
  process.exit(1);
}

function startAgent() {
  log("agent", "starting voice agent server...");
  spawnManaged("agent", path.join(AGENT_DIR, ".venv/bin/python"), ["-m", "agent.voice.server"], {
    cwd: AGENT_DIR,
    // Defensive only: agent logging already goes through loguru's stderr
    // sink, which isn't subject to stdout's block-buffering-on-a-pipe
    // behavior — but this guards against anything else (a stray print(),
    // uvicorn's own access log) writing to stdout and getting buffered.
    env: { PYTHONUNBUFFERED: "1" },
  });
}

function startTurbo() {
  log("dev", "starting api + admin + mailer (turbo run dev)...");
  // Inherits stdio — turbo already prefixes/colors each workspace's output.
  spawnManaged("turbo", "yarn", ["turbo", "run", "dev"], { inherit: true });
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("dev", `${signal} received — stopping everything this session started...`);

  for (const { name, proc } of [...children].reverse()) {
    try {
      log(name, "stopping...");
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }

  await new Promise((r) => setTimeout(r, 3000));

  for (const { proc } of children) {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }

  log("dev", "done.");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

(async () => {
  await ensureOllama();
  await ensureRedis();
  await ensureMailpit();
  startAgent();
  startTurbo();

  log("dev", "all services starting — Ctrl+C to stop everything this session owns.");
})();
