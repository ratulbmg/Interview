import { baseApi, ApiEnvelope } from "./baseApi";

export type QuestionType = "ROLE" | "CV_BASED" | "GAP" | "SCENARIO" | "BEHAVIORAL";

export interface Question {
  id: number;
  text: string;
  competency: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  timesAsked: number;
  questionType: QuestionType;
  objective: string | null;
  expectedSignals: string[];
  maxFollowups: number;
  maxDurationSeconds: number;
}

/** Matches apps/api's createQuestionSchema exactly — every field but the
 * first three has a server-side default, so the form only needs to send
 * what the recruiter actually filled in for those. */
export interface CreateQuestionRequest {
  text: string;
  competency: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags?: string[];
  questionType?: QuestionType;
  objective?: string;
  expectedSignals?: string[];
  maxFollowups?: number;
  maxDurationSeconds?: number;
}

export const questionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listQuestions: builder.query<Question[], void>({
      query: () => "/questions",
      transformResponse: (response: ApiEnvelope<Question[]>) => response.data,
      providesTags: ["Question"],
    }),
    addQuestion: builder.mutation<Question, CreateQuestionRequest>({
      query: (body) => ({ url: "/questions", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<Question>) => response.data,
      invalidatesTags: ["Question"],
    }),
  }),
});

export const { useListQuestionsQuery, useAddQuestionMutation } = questionsApi;
