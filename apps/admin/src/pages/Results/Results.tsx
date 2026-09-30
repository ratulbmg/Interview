import { useState } from "react";
import { Badge, Card, Skeleton } from "@repo/ui";
import {
  SessionResult,
  useListResultsQuery,
} from "../../redux/api/resultsApi";

type Tab = "eligible" | "notEligible";

function ResultCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </Card>
  );
}

function ResultsListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <ResultCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Eligible/Not Eligible is a fixed 80%-of-all-scores threshold computed on
 * apps/api (see lib/eligibility.ts) — never an average this page invents
 * itself. Only sessions that have actually been scored show up here at
 * all (see sessionService.listResults); a session still awaiting a score
 * belongs on the Sessions page, not here. */
export default function Results() {
  const { data: results, isLoading } = useListResultsQuery();
  const [tab, setTab] = useState<Tab>("eligible");

  const eligible = results?.filter((r) => r.eligible) ?? [];
  const notEligible = results?.filter((r) => !r.eligible) ?? [];
  const active = tab === "eligible" ? eligible : notEligible;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-foreground">Results</h1>

      <div className="mb-4 flex gap-1 border-b border-border">
        <TabButton
          label="Eligible"
          count={eligible.length}
          active={tab === "eligible"}
          onClick={() => setTab("eligible")}
        />
        <TabButton
          label="Not Eligible"
          count={notEligible.length}
          active={tab === "notEligible"}
          onClick={() => setTab("notEligible")}
        />
      </div>

      {isLoading ? (
        <ResultsListSkeleton />
      ) : active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {tab === "eligible"
            ? "No candidates have met the eligibility bar yet."
            : "No candidates have fallen short of the eligibility bar yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((result) => (
            <ResultCard key={result.sessionId} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <Badge variant={active ? "default" : "secondary"}>{count}</Badge>
    </button>
  );
}

function ResultCard({ result }: { result: SessionResult }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {result.candidateName}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.roleName} ·{" "}
            {new Date(result.scheduledAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={result.eligible ? "default" : "destructive"}>
          {result.overallPercentage}%
        </Badge>
      </div>

      {!result.eligible && result.negativePoints.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why this candidate wasn&apos;t selected
          </p>
          <ul className="space-y-1.5">
            {result.negativePoints.map((point, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium text-foreground">
                  {point.label}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({point.score}/5)
                </span>
                <p className="italic text-muted-foreground">
                  &ldquo;{point.evidence}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
