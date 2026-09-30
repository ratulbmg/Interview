import { ReactNode } from "react";
import { Badge, Card } from "@repo/ui";
import { useGetUsageCostQuery } from "../../redux/api/usageApi";

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/**
 * Its own tab, not a Dashboard section — this is temporary, dummy data
 * (see apps/engine/cost.txt's own header comment and usageService.ts's
 * doc comment) read through GET /usage/cost, never computed here. Every
 * figure starts at zero until real per-interview usage tracking exists.
 */
export default function Usage() {
  const { data: usageCost, isLoading, isError } = useGetUsageCostQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            AI Usage & Infrastructure
          </h1>
          <p className="text-sm text-muted-foreground">
            What the AI interviewer and its infrastructure are costing —
            model usage, hosting, and per-interview averages.
          </p>
        </div>
        <Badge variant="secondary">Demo / Estimated Data</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError || !usageCost ? (
        <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load usage/cost data. This is temporary demo data read
          from a file on the server — if the file is missing or malformed,
          this page has nothing to show.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Total Interviews"
              value={usageCost.dashboard.totalInterviews.toLocaleString()}
            />
            <StatCard
              label="Interview Minutes"
              value={usageCost.dashboard.totalInterviewMinutes.toLocaleString()}
            />
            <StatCard
              label="LLM Tokens"
              value={usageCost.dashboard.llmTokensTotal.toLocaleString()}
            />
            <StatCard
              label="STT Minutes"
              value={usageCost.dashboard.sttMinutes.toLocaleString()}
            />
            <StatCard
              label="TTS Characters"
              value={usageCost.dashboard.ttsCharacters.toLocaleString()}
            />
            <StatCard
              label="AI Cost"
              value={formatUsd(usageCost.dashboard.totalAICostUsd)}
            />
            <StatCard
              label="Infrastructure Cost"
              value={formatUsd(usageCost.dashboard.totalInfrastructureCostUsd)}
            />
            <StatCard
              label="Total Platform Cost"
              value={formatUsd(usageCost.dashboard.totalPlatformCostUsd)}
            />
            <StatCard
              label="Avg. AI Cost / Interview"
              value={formatUsd(usageCost.dashboard.averageAICostPerInterviewUsd)}
            />
            <StatCard
              label="Avg. Platform Cost / Interview"
              value={formatUsd(
                usageCost.dashboard.averagePlatformCostPerInterviewUsd,
              )}
            />
          </div>

          <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                LLM
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {usageCost.llm.provider} / {usageCost.llm.model}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                STT
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {usageCost.stt.provider} / {usageCost.stt.model}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                TTS
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {usageCost.tts.provider} / {usageCost.tts.model}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Embeddings
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {usageCost.embeddings.provider} / {usageCost.embeddings.model}
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
