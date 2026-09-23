import { Router } from "express";

/**
 * Root router. Resource routers (candidates, roles, sessions, questions,
 * auth) are mounted here starting Phase 3 — see the build plan in
 * README.md.
 */
const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
