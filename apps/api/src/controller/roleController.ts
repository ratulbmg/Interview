import { Request, Response } from "express";
import { roleService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { createRoleSchema } from "../validation";

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const response = await roleService.listRoles(req.user!.id);
  res.status(200).json(new ApiResponse(200, response, "Roles fetched"));
});

export const addRole = asyncHandler(async (req: Request, res: Response) => {
  const validated = createRoleSchema.parse(req.body);
  const response = await roleService.createRole(validated, req.user!.id);
  res.status(201).json(new ApiResponse(201, response, "Role added"));
});
