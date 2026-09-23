import { Request, Response } from "express";
import { Prisma } from "@repo/db/client";
import { sessionService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { receiveTranscriptSchema } from "../validation";
import { idParamSchema } from "../validation";

export const receiveTranscript = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { transcript } = receiveTranscriptSchema.parse(req.body);
    // Zod validated the shape (array of { role, content }); `content` itself
    // is arbitrary JSON from an external process (the Python agent), which
    // is exactly what Prisma's Json column type is for.
    const response = await sessionService.receiveTranscript(
      id,
      transcript as Prisma.InputJsonValue,
    );
    res.status(200).json(new ApiResponse(200, response, "Transcript received"));
  },
);
