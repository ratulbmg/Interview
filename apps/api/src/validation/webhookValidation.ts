import z from "zod";

export const receiveTranscriptSchema = z.object({
  transcript: z.array(
    z.object({
      role: z.string(),
      content: z.unknown(),
    }),
  ),
});
