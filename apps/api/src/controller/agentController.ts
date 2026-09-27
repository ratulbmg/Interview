import { Request, Response } from "express";
import { sessionService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { idParamSchema } from "../validation";
import {
  joinRoomSchema,
  questionsSelectedSchema,
  disconnectedSchema,
} from "../validation";

/**
 * apps/engine (Python) calls this the moment a candidate's
 * browser connects to a room, with just the room token — apps/api is "the
 * boss" and decides everything else (speak-and-end vs. start vs. resume,
 * and the exact message text), see sessionService.getJoinInstruction.
 */
export const joinRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomToken } = joinRoomSchema.parse(req.body);
  const instruction = await sessionService.getJoinInstruction(roomToken);
  res
    .status(200)
    .json(new ApiResponse(200, instruction, "Join instruction resolved"));
});

/** Called once apps/engine's agent-start job has selected the
 * interview's questions — gates the fresh-start half of
 * getJoinInstruction's SCHEDULED/INVITE_SENT branch. */
export const questionsSelected = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { selectedQuestions } = questionsSelectedSchema.parse(req.body);
    await sessionService.saveSelectedQuestions(id, selectedQuestions);
    res
      .status(200)
      .json(new ApiResponse(200, null, "Selected questions saved"));
  },
);

/** Called once the candidate has heard and responded to the
 * recording/AI-evaluation notice at the start of the call. */
export const consentGiven = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await sessionService.recordConsent(id);
    res.status(200).json(new ApiResponse(200, null, "Consent recorded"));
  },
);

/** Called on every candidate disconnect — a deliberate end
 * (endedDeliberately: true) is scored and finalized immediately; anything
 * else just checkpoints progress for a later resume. */
export const disconnected = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { transcript, selectedQuestions, endedDeliberately } =
      disconnectedSchema.parse(req.body);
    await sessionService.reportDisconnect(
      id,
      transcript,
      selectedQuestions,
      endedDeliberately,
    );
    res.status(200).json(new ApiResponse(200, null, "Disconnect recorded"));
  },
);
