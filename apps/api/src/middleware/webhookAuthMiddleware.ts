import { Request, Response, NextFunction } from "express";
import { apiError } from "../utils/apiError";

/**
 * apps/engine posts here directly — it's a Python process, not a
 * logged-in recruiter, so it can't carry the admin app's JWT cookie. Guards
 * every route under /agent/... (see routes/agentRoute.ts) with a long
 * shared secret instead (AGENT_WEBHOOK_SECRET — must be the same value in
 * both apps' .env files). The same secret is also sent in the opposite
 * direction, by apps/api's own lib/agentClient.ts, when apps/api calls
 * back into the agent's /score endpoint — same header name, same trust
 * boundary, just reversed.
 */
export default function webhookAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const expected = process.env.AGENT_WEBHOOK_SECRET;
  if (!expected) {
    next(
      new Error(
        "AGENT_WEBHOOK_SECRET is not set. Refusing to accept webhook calls.",
      ),
    );
    return;
  }

  const provided = req.header("X-Agent-Webhook-Secret");
  if (provided !== expected) {
    next(new apiError("Invalid webhook secret", 401));
    return;
  }

  next();
}
