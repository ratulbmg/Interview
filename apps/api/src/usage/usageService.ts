import { apiError } from "../utils/apiError";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { readCostFile } from "./costFileReader";
import { ParsedCostFile, UsageCostResponse } from "./usageTypes";

function readString(
  sections: ParsedCostFile,
  section: string,
  key: string,
): string {
  const value = sections[section]?.[key];
  if (value === undefined) {
    throw new apiError(
      `Cost data file is malformed: missing "${key}" in [${section}]`,
      500,
    );
  }
  return String(value);
}

function readNumber(
  sections: ParsedCostFile,
  section: string,
  key: string,
): number {
  const value = sections[section]?.[key];
  if (typeof value !== "number") {
    throw new apiError(
      `Cost data file is malformed: "${key}" in [${section}] must be a number`,
      500,
    );
  }
  return value;
}

/** Rounds to 4 decimal places — enough precision for a per-interview
 * average in the thousandths without printing float noise (0.1 + 0.2
 * style artifacts) in the API response. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * apps/api's one entry point for "what does AI usage/cost look like right
 * now" — the AI Usage page, via GET /usage/cost, only ever calls this
 * function and never touches costFileReader.ts or the session repository
 * directly.
 *
 * This is where "Usage Events -> Pricing -> Calculated Cost" actually
 * happens now: real per-session usage (recorded by apps/engine's
 * ServiceMetricsObserver, summed here via
 * sessionRepository.aggregateUsageForUser) is multiplied by the per-unit
 * pricing rates in apps/engine/cost.txt. Only the pricing rates
 * themselves and the flat infrastructure estimate still come from that
 * file — there's nothing to "measure" for either of those without a real
 * billing integration. When infrastructure cost gets a real source too,
 * only this function's body changes; usageController.ts and the frontend
 * don't.
 */
export async function getUsageCost(userId: number): Promise<UsageCostResponse> {
  const sections = readCostFile();

  const llmInputCostPer1M = readNumber(sections, "llm", "inputCostPer1M");
  const llmOutputCostPer1M = readNumber(sections, "llm", "outputCostPer1M");
  const sttCostPerMinute = readNumber(sections, "stt", "costPerMinute");
  const ttsCostPer1MCharacters = readNumber(
    sections,
    "tts",
    "costPer1MCharacters",
  );
  const totalInfrastructureCostUsd = readNumber(
    sections,
    "infrastructure",
    "totalMonthlyUsd",
  );

  const usage =
    await repositoryWrapper.sessionRepository.aggregateUsageForUser(userId);

  const llmTokensTotal = usage.llmPromptTokens + usage.llmCompletionTokens;
  const totalInterviewMinutes = usage.interviewSeconds / 60;
  const sttMinutes = usage.sttAudioSeconds / 60;

  const llmCostUsd =
    (usage.llmPromptTokens / 1_000_000) * llmInputCostPer1M +
    (usage.llmCompletionTokens / 1_000_000) * llmOutputCostPer1M;
  const sttCostUsd = sttMinutes * sttCostPerMinute;
  const ttsCostUsd = (usage.ttsCharacters / 1_000_000) * ttsCostPer1MCharacters;
  const totalAICostUsd = llmCostUsd + sttCostUsd + ttsCostUsd;
  const totalPlatformCostUsd = totalAICostUsd + totalInfrastructureCostUsd;

  const averageAICostPerInterviewUsd =
    usage.totalInterviews > 0 ? totalAICostUsd / usage.totalInterviews : 0;
  const averagePlatformCostPerInterviewUsd =
    usage.totalInterviews > 0
      ? totalPlatformCostUsd / usage.totalInterviews
      : 0;

  return {
    source: readString(sections, "meta", "source"),
    currency: readString(sections, "meta", "currency"),
    llm: {
      provider: readString(sections, "llm", "provider"),
      model: readString(sections, "llm", "model"),
      hosting: readString(sections, "llm", "hosting"),
      inputCostPer1M: llmInputCostPer1M,
      outputCostPer1M: llmOutputCostPer1M,
    },
    stt: {
      provider: readString(sections, "stt", "provider"),
      model: readString(sections, "stt", "model"),
      hosting: readString(sections, "stt", "hosting"),
      costPerMinute: sttCostPerMinute,
    },
    tts: {
      provider: readString(sections, "tts", "provider"),
      model: readString(sections, "tts", "model"),
      hosting: readString(sections, "tts", "hosting"),
      costPer1MCharacters: ttsCostPer1MCharacters,
    },
    embeddings: {
      provider: readString(sections, "embeddings", "provider"),
      model: readString(sections, "embeddings", "model"),
      hosting: readString(sections, "embeddings", "hosting"),
      costPer1MTokens: readNumber(sections, "embeddings", "costPer1MTokens"),
    },
    dashboard: {
      totalInterviews: usage.totalInterviews,
      totalInterviewMinutes: round(totalInterviewMinutes, 1),
      llmTokensTotal,
      sttMinutes: round(sttMinutes, 1),
      ttsCharacters: usage.ttsCharacters,
      totalAICostUsd: round(totalAICostUsd, 4),
      totalInfrastructureCostUsd,
      totalPlatformCostUsd: round(totalPlatformCostUsd, 4),
      averageAICostPerInterviewUsd: round(averageAICostPerInterviewUsd, 4),
      averagePlatformCostPerInterviewUsd: round(
        averagePlatformCostPerInterviewUsd,
        4,
      ),
    },
  };
}
