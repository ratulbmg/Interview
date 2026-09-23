import { Router } from "express";
import { receiveTranscript } from "../controller";
import webhookAuth from "../middleware/webhookAuthMiddleware";

const webhookRouter = Router();

// Posted by apps/interview-agent (Python), not the dashboard — guarded by
// a shared secret (webhookAuth), not the recruiter JWT cookie.
webhookRouter.post(
  "/webhooks/sessions/:id/transcript",
  webhookAuth,
  receiveTranscript,
);

export default webhookRouter;
