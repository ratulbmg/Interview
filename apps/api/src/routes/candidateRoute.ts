import { Router } from "express";
import { listCandidates, addCandidate, deleteCandidate } from "../controller";
import authenticate from "../middleware/authMiddleware";
import { uploadCv } from "../middleware/uploadMiddleware";

const candidateRouter = Router();

candidateRouter.get("/candidates", authenticate, listCandidates);
// Adding a candidate is its own form (email, optional name, CV) — no role,
// no schedule. See sessionRoute.ts for the separate "schedule" action.
candidateRouter.post("/candidates", authenticate, uploadCv, addCandidate);
// Cascades to all of this candidate's sessions at the DB level — see
// packages/db/prisma/schema.prisma's onDelete: Cascade.
candidateRouter.delete("/candidates/:id", authenticate, deleteCandidate);

export default candidateRouter;
