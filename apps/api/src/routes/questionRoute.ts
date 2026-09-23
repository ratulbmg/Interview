import { Router } from "express";
import { listQuestions } from "../controller";
import authenticate from "../middleware/authMiddleware";

const questionRouter = Router();

// The question bank is a read-only view here — seeded and grown by
// apps/interview-agent, not authored through the dashboard.
questionRouter.get("/questions", authenticate, listQuestions);

export default questionRouter;
