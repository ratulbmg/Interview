import { Request, Response } from "express";
import { sessionService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { scheduleSessionSchema, idParamSchema } from "../validation";

export const listSessions = asyncHandler(
  async (req: Request, res: Response) => {
    const response = await sessionService.listSessions();
    res.status(200).json(new ApiResponse(200, response, "Sessions fetched"));
  },
);

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const response = await sessionService.getSession(id);
  res.status(200).json(new ApiResponse(200, response, "Session fetched"));
});

export const scheduleSession = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = scheduleSessionSchema.parse(req.body);
    const response = await sessionService.scheduleSession({
      ...validated,
      scheduledAt: validated.scheduledAt.toISOString(),
    });
    res.status(201).json(new ApiResponse(201, response, "Session scheduled"));
  },
);

export const sendInvite = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const response = await sessionService.sendInvite(id);
  res.status(200).json(new ApiResponse(200, response, "Invite sent"));
});

export const deleteSession = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await sessionService.deleteSession(id);
    res.status(200).json(new ApiResponse(200, null, "Session deleted"));
  },
);
