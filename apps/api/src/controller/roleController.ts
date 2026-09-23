import { Request, Response } from "express";
import { roleService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const response = await roleService.listRoles();
  res.status(200).json(new ApiResponse(200, response, "Roles fetched"));
});
