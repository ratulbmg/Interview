import { Router } from "express";
import { listCandidates, addCandidate } from "../controller";
import authenticate from "../middleware/authMiddleware";
import { uploadCv } from "../middleware/uploadMiddleware";

const candidateRouter = Router();

candidateRouter.get("/candidates", authenticate, listCandidates);
// Adding a candidate is its own form (email, optional name, CV) — no role,
// no schedule. See sessionRoute.ts for the separate "schedule" action.
candidateRouter.post("/candidates", authenticate, uploadCv, addCandidate);

export default candidateRouter;
