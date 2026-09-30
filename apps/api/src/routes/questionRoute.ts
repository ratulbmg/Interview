import { Router } from "express";
import {
  listQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controller";
import authenticate from "../middleware/authMiddleware";

const questionRouter = Router();

// Question CRUD is scoped to the logged-in recruiter throughout (see
// questionService.ts) — each recruiter only ever sees, edits, or deletes
// questions they added, never a shared cross-recruiter bank, and apps/engine
// still never creates/edits/deletes a question itself (see
// agent/interview/db.py — it only ever reads this bank and writes back an
// embedding/usage count via POST /agent/data).
questionRouter.get("/questions", authenticate, listQuestions);
questionRouter.post("/questions", authenticate, addQuestion);
questionRouter.patch("/questions/:id", authenticate, updateQuestion);
questionRouter.delete("/questions/:id", authenticate, deleteQuestion);

export default questionRouter;
