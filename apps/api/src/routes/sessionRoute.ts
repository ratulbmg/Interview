import { Router } from "express";
import {
  listSessions,
  getSession,
  scheduleSession,
  sendInvite,
} from "../controller";
import authenticate from "../middleware/authMiddleware";

const sessionRouter = Router();

sessionRouter.get("/sessions", authenticate, listSessions);
sessionRouter.get("/sessions/:id", authenticate, getSession);
sessionRouter.post("/sessions", authenticate, scheduleSession);
// The recruiter's last required action — see sessionService.sendInvite for
// what Phase 4/5 add here.
sessionRouter.post("/sessions/:id/send-invite", authenticate, sendInvite);

export default sessionRouter;
