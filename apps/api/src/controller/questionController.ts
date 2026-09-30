import { Request, Response } from "express";
import { questionService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { idParamSchema, createQuestionSchema, updateQuestionSchema } from "../validation";

export const listQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const response = await questionService.listQuestions(req.user!.id);
    res.status(200).json(new ApiResponse(200, response, "Questions fetched"));
  },
);

export const addQuestion = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = createQuestionSchema.parse(req.body);
    const response = await questionService.createQuestion(
      validated,
      req.user!.id,
    );
    res.status(201).json(new ApiResponse(201, response, "Question added"));
  },
);

export const updateQuestion = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = updateQuestionSchema.parse(req.body);
    const response = await questionService.updateQuestion(
      id,
      validated,
      req.user!.id,
    );
    res.status(200).json(new ApiResponse(200, response, "Question updated"));
  },
);

export const deleteQuestion = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await questionService.deleteQuestion(id, req.user!.id);
    res.status(200).json(new ApiResponse(200, null, "Question deleted"));
  },
);
