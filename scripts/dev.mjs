#!/usr/bin/env node
// Single entry point for local dev: `yarn dev` / `npm run dev`.
//
// Replaces what docker-compose.dev.yml used to do — bring up everything
// this project needs, in one command, and tear it all back down on
// Ctrl+C — but for a project with no Docker any more (see the Interview
// System Map artifact's "No Docker" section for why): Ollama, Redis and
// Mailpit are plain local processes instead of containers, and the
// Python interview-agent (not a yarn workspace member) is spawned
// alongside the TypeScript apps instead of needing its own terminal.
//
// Anything already running when this starts (most likely Ollama, if
// it's set up to launch at login) is left alone on shutdown — this script
// only stops what it started itself.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_DIR = path.join(ROOT, "apps/interview-agent");

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

async function waitUntil(checkFn, { attempts = 20, delayMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (await checkFn()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function ensureOllama() {
  if (await checkHttp("http://localhost:11434/api/tags")) {
    log("ollama", "already running — leaving it alone");
    return;
  }
  log("ollama", "not running, starting `ollama serve`...");
  spawnManaged("ollama", "ollama", ["serve"]);
  const ok = await waitUntil(() => checkHttp("http://localhost:11434/api/tags"));
  log("ollama", ok ? "ready" : "WARNING: did not come up in time — is Ollama installed?");
}

async function ensureRedis() {
  if (await checkTcp(6379)) {
    log("redis", "already running — leaving it alone");
    return;
  }
  log("redis", "not running, starting redis-server...");
  // --save "" disables RDB snapshotting: this queue is disposable dev data
  // (email/agent-jobs), and without this it drops a dump.rdb in whatever
  // directory the shell happened to be in on every shutdown.
  spawnManaged("redis", "redis-server", ["--port", "6379", "--save", ""]);
  const ok = await waitUntil(() => checkTcp(6379));
  log("redis", ok ? "ready" : "WARNING: did not come up in time — is redis installed? (brew install redis)");
}

async function ensureMailpit() {
  if (await checkTcp(1025)) {
    log("mailpit", "already running — leaving it alone");
    return;
  }
  log("mailpit", "not running, starting mailpit...");
  spawnManaged("mailpit", "mailpit", []);
  const ok = await waitUntil(() => checkTcp(1025));
  log("mailpit", ok ? "ready — UI at http://localhost:8025" : "WARNING: did not come up in time — is mailpit installed? (brew install mailpit)");
}

function startAgent() {
  log("agent", "starting interview-agent voice server...");
  spawnManaged("agent", path.join(AGENT_DIR, ".venv/bin/python"), ["-m", "agent.voice.server"], {
    cwd: AGENT_DIR,
  });
}

function startTurbo() {
  log("dev", "starting api + dashboard + email-worker (turbo run dev)...");
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
