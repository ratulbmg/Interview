import { Router } from "express";
import { listRoles, addRole } from "../controller";
import authenticate from "../middleware/authMiddleware";

const roleRouter = Router();

// The two original roles were seeded (packages/db/src/seed.ts); a
// recruiter can now add their own too, scoped to just them (see
// roleService.createRole) — never a shared cross-recruiter list.
roleRouter.get("/roles", authenticate, listRoles);
roleRouter.post("/roles", authenticate, addRole);

export default roleRouter;
