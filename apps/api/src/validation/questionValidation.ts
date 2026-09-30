import z from "zod";
import { QuestionDifficulty, QuestionType } from "../enum";

// Cast to the literal union (not a plain string tuple) so z.enum infers
// "EASY" | "MEDIUM" | "HARD" / the QuestionType union, not just `string` —
// that's what lets createQuestionSchema/updateQuestionSchema's inferred
// output satisfy CreateQuestionRequest/UpdateQuestionRequest's narrower
// field types without a cast at every call site.
const difficultyValues = Object.values(QuestionDifficulty) as [
  QuestionDifficulty,
  ...QuestionDifficulty[],
];
const questionTypeValues = Object.values(QuestionType) as [
  QuestionType,
  ...QuestionType[],
];

/**
 * POST /questions — a recruiter authoring a question for their own bank.
 * `objective`/`expectedSignals` drive apps/engine's adaptive follow-up
 * logic (see agent/interview/answer_analyzer.py) but aren't required here
 * — a question with no expectedSignals just skips adaptive analysis and
 * falls back to the deterministic turn/duration limits (see
 * followup_policy.py), it never crashes the interview.
 */
export const createQuestionSchema = z.object({
  text: z.string().trim().min(1, { message: "Please enter the question text" }),
  competency: z
    .string()
    .trim()
    .min(1, { message: "Please enter a competency" }),
  difficulty: z.enum(difficultyValues, {
    message: "Please pick a difficulty",
  }),
  tags: z.array(z.string().trim().min(1)).default([]),
  questionType: z.enum(questionTypeValues).default("ROLE"),
  objective: z.string().trim().min(1).nullish(),
  expectedSignals: z.array(z.string().trim().min(1)).default([]),
  maxFollowups: z.coerce.number().int().min(0).default(2),
  maxDurationSeconds: z.coerce.number().int().min(1).default(180),
});

/**
 * PATCH /questions/:id — every field optional, and deliberately with no
 * `.default(...)` on any of them (unlike createQuestionSchema above): an
 * omitted field here must mean "leave it alone," not "reset it to the
 * default," so questionService.updateQuestion only ever spreads the keys
 * that were actually present in the request body.
 */
export const updateQuestionSchema = z.object({
  text: z.string().trim().min(1).optional(),
  competency: z.string().trim().min(1).optional(),
  difficulty: z.enum(difficultyValues).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  questionType: z.enum(questionTypeValues).optional(),
  objective: z.string().trim().min(1).nullish(),
  expectedSignals: z.array(z.string().trim().min(1)).optional(),
  maxFollowups: z.coerce.number().int().min(0).optional(),
  maxDurationSeconds: z.coerce.number().int().min(1).optional(),
});
