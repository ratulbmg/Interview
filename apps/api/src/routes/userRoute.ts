import { Router } from "express";
import { listUsers } from "../controller";
import authenticate from "../middleware/authMiddleware";

const userRouter = Router();

// Every logged-in recruiter can see the full list of recruiter accounts —
// there's no admin/non-admin distinction on User yet (see
// packages/db/prisma/schema.prisma), so this is intentionally NOT scoped
// to just the caller the way Candidate/Role/Question/InterviewSession are
// (see roleRoute.ts).
userRouter.get("/users", authenticate, listUsers);

export default userRouter;
