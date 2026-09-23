import { Router } from "express";
import { loginUser, logoutUser, meAccount } from "../controller";
import authenticate from "../middleware/authMiddleware";
import { authLimiter } from "../middleware/rateLimitMiddleware";

const authRouter = Router();

authRouter.post("/auth/login", authLimiter, loginUser);
authRouter.post("/auth/logout", authenticate, logoutUser);
authRouter.get("/auth/me", authenticate, meAccount);

export default authRouter;
