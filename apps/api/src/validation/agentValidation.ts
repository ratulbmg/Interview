import z from "zod";

// Carries apps/engine's full adaptive-questioning metadata through the
// checkpoint round-trip — see model/sessionModel.ts's SelectedQuestionDto
// for why every one of these fields has to survive both
// questions-selected (written) and disconnected (read back on resume).
const selectedQuestionSchema = z.object({
  id: z.coerce.number().int(),
  slot: z.string(),
  competency: z.string(),
  questionText: z.string(),
  difficulty: z.string(),
  questionType: z.string(),
  objective: z.string().nullable(),
  expectedSignals: z.array(z.string()),
  maxFollowups: z.coerce.number().int(),
  maxDurationSeconds: z.coerce.number().int(),
});

const transcriptTurnSchema = z.object({
  role: z.string(),
  content: z.string(),
});

// What apps/engine's ServiceMetricsObserver measured for one connection
// segment (see agent/conversation/manager.py) — optional so an older agent
// build that hasn't redeployed yet can still call /disconnected without it.
const disconnectUsageSchema = z
  .object({
    llmPromptTokens: z.coerce.number().min(0).default(0),
    llmCompletionTokens: z.coerce.number().min(0).default(0),
    sttAudioSeconds: z.coerce.number().min(0).default(0),
    ttsCharacters: z.coerce.number().min(0).default(0),
    interviewSeconds: z.coerce.number().min(0).default(0),
  })
  .optional();

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
  usage: disconnectUsageSchema,
});

/**
 * POST /agent/data — the one route apps/engine uses for every Postgres
 * read/write it needs (see service/agentDataService.ts). apps/engine has no
 * database connection of its own at all; every one of these actions is a
 * direct port of what used to be a function in its own agent/interview/
 * db.py talking straight to Postgres via psycopg.
 */
export const agentDataRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("getUserIdByEmail"), email: z.string() }),
  z.object({
    action: z.literal("getRoleByName"),
    name: z.string(),
    createdById: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("getRoleById"),
    roleId: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("getCandidateById"),
    candidateId: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("saveCandidateCvParsed"),
    candidateId: z.coerce.number().int().positive(),
    cvParsedJson: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("getQuestions"),
    createdById: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("saveQuestionEmbedding"),
    questionId: z.coerce.number().int().positive(),
    embedding: z.array(z.number()),
  }),
  z.object({
    action: z.literal("markQuestionsAsked"),
    questionIds: z.array(z.coerce.number().int().positive()),
  }),
]);

export type AgentDataRequest = z.infer<typeof agentDataRequestSchema>;
