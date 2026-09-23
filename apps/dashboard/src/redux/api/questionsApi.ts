import { baseApi, ApiEnvelope } from "./baseApi";

export interface Question {
  id: number;
  text: string;
  competency: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  timesAsked: number;
}

export const questionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listQuestions: builder.query<Question[], void>({
      query: () => "/questions",
      transformResponse: (response: ApiEnvelope<Question[]>) => response.data,
      providesTags: ["Question"],
    }),
  }),
});

export const { useListQuestionsQuery } = questionsApi;
