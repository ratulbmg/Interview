import { Request, Response, NextFunction } from "express";
import { apiError } from "../utils/apiError";

/**
 * apps/interview-agent posts here directly — it's a Python process, not a
 * logged-in recruiter, so it can't carry the dashboard's JWT cookie.
 * Guards this route with a long shared secret instead (see
 * AGENT_WEBHOOK_SECRET in both .env.example files — must match).
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
