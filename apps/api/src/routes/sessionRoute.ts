import { Router } from "express";
import {
  listSessions,
  getSession,
  scheduleSession,
  sendInvite,
  deleteSession,
} from "../controller";
import authenticate from "../middleware/authMiddleware";

const sessionRouter = Router();

sessionRouter.get("/sessions", authenticate, listSessions);
sessionRouter.get("/sessions/:id", authenticate, getSession);
sessionRouter.post("/sessions", authenticate, scheduleSession);
// The recruiter's last required action — see sessionService.sendInvite for
// what Phase 4/5 add here.
sessionRouter.post("/sessions/:id/send-invite", authenticate, sendInvite);
// Deletes only this session — never the candidate or their other sessions.
sessionRouter.delete("/sessions/:id", authenticate, deleteSession);

export default sessionRouter;
