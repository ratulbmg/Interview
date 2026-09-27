import { Router } from "express";
import {
  joinRoom,
  questionsSelected,
  consentGiven,
  disconnected,
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

export default agentRouter;
