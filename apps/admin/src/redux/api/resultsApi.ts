import { baseApi, ApiEnvelope } from "./baseApi";

export interface NegativePoint {
  label: string;
  score: number;
  evidence: string;
}

export interface DimensionSummary {
  dimension: string;
  score: number;
}

/** One scored session, with the Eligible/Not Eligible verdict apps/api
 * derives from it (see apps/api's lib/eligibility.ts) — a hardcoded 80%
 * threshold across every competency + dimension score, averaged.
 * `dimensionScores` is score-only (no evidence) — the Dashboard page
 * averages it across sessions; the Results page itself doesn't use it. */
export interface SessionResult {
  sessionId: number;
  candidateName: string;
  candidateEmail: string;
  roleName: string;
  scheduledAt: string;
  overallPercentage: number;
  eligible: boolean;
  negativePoints: NegativePoint[];
  dimensionScores: DimensionSummary[];
}

export const resultsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listResults: builder.query<SessionResult[], void>({
      query: () => "/results",
      transformResponse: (response: ApiEnvelope<SessionResult[]>) =>
        response.data,
      providesTags: ["Session"],
    }),
  }),
});

export const { useListResultsQuery } = resultsApi;
