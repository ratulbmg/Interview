import { Router } from "express";
import { listRoles } from "../controller";
import authenticate from "../middleware/authMiddleware";

const roleRouter = Router();

// Roles are seeded (packages/db/src/seed.ts), not managed through this API.
roleRouter.get("/roles", authenticate, listRoles);

export default roleRouter;
