import { baseApi, ApiEnvelope } from "./baseApi";

interface ModelInfo {
  provider: string;
  model: string;
  hosting: string;
}

/** Mirrors apps/api's UsageCostResponse (usage/usageTypes.ts) exactly —
 * this is temporary, dummy data read from apps/engine/cost.txt, not real
 * billing. See that file's own header comment for the planned swap to
 * real usage-event + pricing data. */
export interface UsageCost {
  source: string;
  currency: string;
  llm: ModelInfo & { inputCostPer1M: number; outputCostPer1M: number };
  stt: ModelInfo & { costPerMinute: number };
  tts: ModelInfo & { costPer1MCharacters: number };
  embeddings: ModelInfo & { costPer1MTokens: number };
  dashboard: {
    totalInterviews: number;
    totalInterviewMinutes: number;
    llmTokensTotal: number;
    sttMinutes: number;
    ttsCharacters: number;
    totalAICostUsd: number;
    totalInfrastructureCostUsd: number;
    totalPlatformCostUsd: number;
    averageAICostPerInterviewUsd: number;
    averagePlatformCostPerInterviewUsd: number;
  };
}

export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsageCost: builder.query<UsageCost, void>({
      query: () => "/usage/cost",
      transformResponse: (response: ApiEnvelope<UsageCost>) => response.data,
      providesTags: ["Usage"],
    }),
  }),
});

export const { useGetUsageCostQuery } = usageApi;
