import { Request, Response } from "express";
import { questionService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const listQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const response = await questionService.listQuestions();
    res.status(200).json(new ApiResponse(200, response, "Questions fetched"));
  },
);
