import { SelectedQuestionDto, TranscriptTurn } from "../model/sessionModel";

/**
 * The one direction the boss/executor relationship runs backwards: scoring
 * a finished interview needs an LLM call only apps/engine can
 * make (it has the LLM client wired to a local Ollama instance), so
 * apps/api — having decided a session should be finalized — calls back
 * into the agent's own HTTP server for a score instead of computing it
 * itself.
 *
 * Guarded by the same shared secret as the old (now-removed)
 * apps/engine -> apps/api webhook, just sent in the opposite
 * direction — see apps/api/src/middleware/webhookAuthMiddleware.ts for the
 * header name this must match, and agent/voice/webhook_client.py (now
 * gone) for the pattern this mirrors.
 */

const SCORE_TIMEOUT_MS = 3 * 60 * 1000; // local Ollama scoring can be slow

export interface ScoreInterviewResult {
  report: unknown;
}

export async function scoreInterview(
  transcript: TranscriptTurn[],
  selectedQuestions: SelectedQuestionDto[],
  roleName: string,
): Promise<ScoreInterviewResult> {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "AGENT_WEBHOOK_SECRET is not set — the agent will reject this call without it.",
    );
  }

  const baseUrl = process.env.AGENT_URL ?? "http://localhost:7860";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCORE_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Webhook-Secret": secret,
      },
      body: JSON.stringify({ transcript, selectedQuestions, roleName }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Agent /score returned ${response.status}: ${body || response.statusText}`,
      );
    }

    return (await response.json()) as ScoreInterviewResult;
  } finally {
    clearTimeout(timeout);
  }
}
