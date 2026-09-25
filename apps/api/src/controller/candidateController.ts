import { Request, Response } from "express";
import { candidateService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { apiError } from "../utils/apiError";
import { addCandidateSchema, idParamSchema } from "../validation";

export const listCandidates = asyncHandler(
  async (req: Request, res: Response) => {
    const response = await candidateService.listCandidates();
    res.status(200).json(new ApiResponse(200, response, "Candidates fetched"));
  },
);

export const addCandidate = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = addCandidateSchema.parse(req.body);
    if (!req.file) {
      throw new apiError("A CV file is required", 400);
    }
    const response = await candidateService.addCandidate(validated, req.file);
    res.status(201).json(new ApiResponse(201, response, "Candidate added"));
  },
);

export const deleteCandidate = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await candidateService.deleteCandidate(id);
    res
      .status(200)
      .json(new ApiResponse(200, null, "Candidate and their sessions deleted"));
  },
);
