import { Router } from "express";
import authenticate from "../middleware/authMiddleware";
import { getCost } from "./usageController";

const usageRouter = Router();

// Real per-recruiter usage/cost reporting — usage totals come from this
// recruiter's own InterviewSession rows, priced with apps/engine/cost.txt's
// still-dummy rates (see usageService.ts's doc comment). Deliberately kept
// out of the shared controller/service/routes barrels so this module stays
// easy to find as one piece.
usageRouter.get("/usage/cost", authenticate, getCost);

export default usageRouter;
