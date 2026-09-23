import { Router } from "express";
import { apiError } from "../utils/apiError";
import authRouter from "./authRoute";
import candidateRouter from "./candidateRoute";
import sessionRouter from "./sessionRoute";
import roleRouter from "./roleRoute";
import questionRouter from "./questionRoute";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use(authRouter);
router.use(candidateRouter);
router.use(sessionRouter);
router.use(roleRouter);
router.use(questionRouter);

router.use(() => {
  throw new apiError("Route not found", 404);
});

export default router;
