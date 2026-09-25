import { useParams } from "react-router-dom";
import { Card } from "@repo/ui";
import { useGetSessionQuery } from "../../redux/api/sessionsApi";

interface CompetencyScore {
  slot: string;
  competency: string;
  score: number;
  evidence: string;
}

interface Report {
  role: string;
  scores: CompetencyScore[];
}

interface TranscriptTurn {
  role: string;
  content: string;
}

function isReport(value: unknown): value is Report {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Report).scores)
  );
}

function isTranscript(value: unknown): value is TranscriptTurn[] {
  return (
    Array.isArray(value) &&
    value.every(
      (turn) => typeof turn === "object" && turn !== null && "role" in turn,
    )
  );
}

/** Report + transcript appear here once apps/interview-engine posts them
 * (see apps/api's sessionService.receiveTranscript) — the recruiter does
 * nothing to trigger it, they just come back and check. */
export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useGetSessionQuery(Number(id));

  if (isLoading || !session) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const report = isReport(session.reportJson) ? session.reportJson : null;
  const transcript = isTranscript(session.transcript)
    ? session.transcript
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {session.candidate.name ?? session.candidate.email} —{" "}
          {session.role.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Status: {session.status} · Scheduled:{" "}
          {new Date(session.scheduledAt).toLocaleString()}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Scored report
        </h2>
        {report ? (
          <div className="space-y-3">
            {report.scores.map((item) => (
              <Card key={item.slot} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {item.competency}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {item.score} / 5
                  </span>
                </div>
                <p className="mt-2 text-sm italic text-muted-foreground">
                  &ldquo;{item.evidence}&rdquo;
                </p>
              </Card>
            ))}
            {report.scores.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Scored, but no competencies were recorded.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No report yet — it appears here once the interview is complete.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Transcript
        </h2>
        {transcript ? (
          <Card className="space-y-2 p-4">
            {transcript.map((turn, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium capitalize text-foreground">
                  {turn.role === "assistant" ? "Interviewer" : "Candidate"}:
                </span>{" "}
                <span className="text-muted-foreground">{turn.content}</span>
              </div>
            ))}
          </Card>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No transcript yet.
          </p>
        )}
      </section>
    </div>
  );
}
