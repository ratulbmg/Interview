import z from "zod";

export const receiveTranscriptSchema = z.object({
  transcript: z.array(
    z.object({
      role: z.string(),
      content: z.unknown(),
    }),
  ),
  // Present whenever apps/interview-engine's own scoring call succeeded —
  // absent (not merely empty) means it failed, so receiveTranscript can
  // tell "no report yet" apart from "scored, zero competencies".
  report: z.unknown().optional(),
});
