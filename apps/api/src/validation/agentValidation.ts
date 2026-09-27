import z from "zod";

const selectedQuestionSchema = z.object({
  slot: z.string(),
  competency: z.string(),
  questionText: z.string(),
});

const transcriptTurnSchema = z.object({
  role: z.string(),
  content: z.string(),
});

// POST /agent/rooms/join
export const joinRoomSchema = z.object({
  roomToken: z.string().min(1),
});

// POST /agent/sessions/:id/questions-selected
export const questionsSelectedSchema = z.object({
  selectedQuestions: z.array(selectedQuestionSchema),
});

// POST /agent/sessions/:id/disconnected
export const disconnectedSchema = z.object({
  transcript: z.array(transcriptTurnSchema),
  selectedQuestions: z.array(selectedQuestionSchema),
  endedDeliberately: z.boolean(),
});
