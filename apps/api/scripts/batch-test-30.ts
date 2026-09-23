/**
 * Phase 8 hardening check: runs 30 candidates through add -> schedule ->
 * send-invite against a live API (yarn dev / yarn dev:local), and fails
 * loudly (non-zero exit, one line per failure) rather than needing a
 * manual fix mid-batch.
 *
 * This exercises the API/DB/Redis pipeline at that scale — not 30 live
 * spoken interviews, which need a browser, a microphone, and a real
 * OPENAI_API_KEY for each one; see apps/interview-agent's own Phase 2/6
 * verification for what's been checked of that half.
 *
 * Usage: API_URL=http://localhost:3001 tsx scripts/batch-test-30.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const BATCH_SIZE = 30;
const CV_PATH = resolve(__dirname, "../../interview-agent/sample.pdf");

interface Result {
  index: number;
  ok: boolean;
  step?: string;
  error?: string;
}

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "recruiter@example.com",
      password: process.env.SEED_RECRUITER_PASSWORD ?? "password",
    }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status}`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("login succeeded but no cookie was set");
  }
  return cookie.split(";")[0];
}

async function runOne(
  index: number,
  cookie: string,
  cvBytes: Buffer,
): Promise<Result> {
  const email = `batch-${Date.now()}-${index}@example.com`;
  try {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("name", `Batch Candidate ${index}`);
    formData.append(
      "cv",
      new Blob([cvBytes], { type: "application/pdf" }),
      "sample.pdf",
    );

    const candidateRes = await fetch(`${API_URL}/candidates`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: formData,
    });
    if (!candidateRes.ok) {
      return {
        index,
        ok: false,
        step: "add candidate",
        error: `${candidateRes.status} ${await candidateRes.text()}`,
      };
    }
    const candidate = (await candidateRes.json()).data;

    const scheduledAt = new Date(
      Date.now() + (2 + (index % 5)) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sessionRes = await fetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        candidateId: candidate.id,
        roleId: (index % 2) + 1,
        scheduledAt,
      }),
    });
    if (!sessionRes.ok) {
      return {
        index,
        ok: false,
        step: "schedule session",
        error: `${sessionRes.status} ${await sessionRes.text()}`,
      };
    }
    const session = (await sessionRes.json()).data;

    const inviteRes = await fetch(
      `${API_URL}/sessions/${session.id}/send-invite`,
      {
        method: "POST",
        headers: { Cookie: cookie },
      },
    );
    if (!inviteRes.ok) {
      return {
        index,
        ok: false,
        step: "send invite",
        error: `${inviteRes.status} ${await inviteRes.text()}`,
      };
    }

    return { index, ok: true };
  } catch (error) {
    return {
      index,
      ok: false,
      step: "unexpected",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`Batch test: ${BATCH_SIZE} candidates against ${API_URL}`);
  const cookie = await login();
  const cvBytes = readFileSync(CV_PATH);

  const results: Result[] = [];
  for (let i = 1; i <= BATCH_SIZE; i++) {
    results.push(await runOne(i, cookie, cvBytes));
  }

  const failures = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failures.length}/${results.length} succeeded.`,
  );
  for (const f of failures) {
    console.error(`  #${f.index} failed at "${f.step}": ${f.error}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main();
