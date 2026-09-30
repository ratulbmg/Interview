import { Request, Response } from "express";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { getUsageCost } from "./usageService";

export const getCost = asyncHandler(async (req: Request, res: Response) => {
  const data = await getUsageCost(req.user!.id);
  res.status(200).json(new ApiResponse(200, data, "Usage cost fetched"));
});
