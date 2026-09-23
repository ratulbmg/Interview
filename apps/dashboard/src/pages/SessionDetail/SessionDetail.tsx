import { useParams } from "react-router-dom";
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

/** Report + transcript appear here once apps/interview-agent posts them
 * (see apps/api's sessionService.receiveTranscript) — the recruiter does
 * nothing to trigger it, they just come back and check. */
export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useGetSessionQuery(Number(id));

  if (isLoading || !session) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const report = isReport(session.reportJson) ? session.reportJson : null;
  const transcript = isTranscript(session.transcript)
    ? session.transcript
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">
          {session.candidate.name ?? session.candidate.email} —{" "}
          {session.role.name}
        </h1>
        <p className="text-sm text-gray-600">
          Status: {session.status} · Scheduled:{" "}
          {new Date(session.scheduledAt).toLocaleString()}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">Scored report</h2>
        {report ? (
          <div className="space-y-3">
            {report.scores.map((item) => (
              <div
                key={item.slot}
                className="rounded border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.competency}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {item.score} / 5
                  </span>
                </div>
                <p className="mt-2 text-sm italic text-gray-600">
                  &ldquo;{item.evidence}&rdquo;
                </p>
              </div>
            ))}
            {report.scores.length === 0 && (
              <p className="text-sm text-gray-400">
                Scored, but no competencies were recorded.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            No report yet — it appears here once the interview is complete.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Transcript</h2>
        {transcript ? (
          <div className="space-y-2 rounded border border-gray-200 bg-white p-4">
            {transcript.map((turn, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium capitalize">
                  {turn.role === "assistant" ? "Interviewer" : "Candidate"}:
                </span>{" "}
                <span className="text-gray-700">{turn.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            No transcript yet.
          </p>
        )}
      </section>
    </div>
  );
}
