/**
 * One flattened INI section — `[llm]\nprovider=ollama` becomes
 * `{ llm: { provider: "ollama" } }`. This is costFileReader.ts's raw
 * output, before usageService.ts picks out the specific sections/keys it
 * knows about and types them as UsageCostResponse below.
 */
export type ParsedCostFile = Record<string, Record<string, string | number>>;

interface ModelInfo {
  provider: string;
  model: string;
  hosting: string;
}

/**
 * The normalized shape the "AI Usage & Infrastructure" page renders —
 * returned by usageService.getUsageCost(userId). `dashboard`'s usage
 * figures (interviews, minutes, tokens, STT seconds, TTS characters) and
 * `totalAICostUsd`/`totalPlatformCostUsd`/the two averages are now
 * computed from real per-session usage in Postgres (see
 * sessionRepository.aggregateUsageForUser) multiplied by the per-unit
 * rates below — only `totalInfrastructureCostUsd` and the provider/model
 * pricing rates themselves (`llm`/`stt`/`tts`/`embeddings`) still come
 * straight from apps/engine/cost.txt, since there's no real measurement
 * behind provider pricing or infrastructure spend to compute from.
 */
export interface UsageCostResponse {
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
