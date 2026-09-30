import { Request, Response } from "express";
import { userService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const listUsers = asyncHandler(
  async (_req: Request, res: Response) => {
    const response = await userService.listUsers();
    res.status(200).json(new ApiResponse(200, response, "Users fetched"));
  },
);
