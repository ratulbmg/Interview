import { Router } from "express";
import {
  joinRoom,
  questionsSelected,
  consentGiven,
  disconnected,
  agentData,
} from "../controller";
import webhookAuth from "../middleware/webhookAuthMiddleware";

const agentRouter = Router();

// Posted by apps/engine (Python), not the admin app — guarded by
// a shared secret (webhookAuth), not the recruiter JWT cookie. apps/api is
// "the boss" for every session-lifecycle decision; the agent is a pure
// executor that asks these routes what to do and reports events back.
agentRouter.post("/agent/rooms/join", webhookAuth, joinRoom);
agentRouter.post(
  "/agent/sessions/:id/questions-selected",
  webhookAuth,
  questionsSelected,
);
agentRouter.post(
  "/agent/sessions/:id/consent-given",
  webhookAuth,
  consentGiven,
);
agentRouter.post(
  "/agent/sessions/:id/disconnected",
  webhookAuth,
  disconnected,
);

// apps/engine has no database connection of its own — this is the one
// route it uses for every Postgres read/write it needs (see
// agentDataService.ts). Its old agent/interview/db.py, which used to talk
// straight to Postgres via psycopg, is now just an HTTP client to this
// single endpoint, one `action` per call.
agentRouter.post("/agent/data", webhookAuth, agentData);

export default agentRouter;
