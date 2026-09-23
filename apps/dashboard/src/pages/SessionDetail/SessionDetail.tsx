import { useParams } from "react-router-dom";
import { useGetSessionQuery } from "../../redux/api/sessionsApi";

/** Transcript + per-competency scored report render here once Phase 7
 * wires them up — the recruiter does nothing to trigger it, they just come
 * back and check. */
export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useGetSessionQuery(Number(id));

  if (isLoading || !session) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">
        {session.candidate.name ?? session.candidate.email} —{" "}
        {session.role.name}
      </h1>
      <p className="text-sm text-gray-600">
        Status: {session.status} · Scheduled:{" "}
        {new Date(session.scheduledAt).toLocaleString()}
      </p>

      {session.reportJson ? (
        <pre className="overflow-x-auto rounded border border-gray-200 bg-white p-4 text-xs">
          {JSON.stringify(session.reportJson, null, 2)}
        </pre>
      ) : (
        <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          No report yet — it appears here once the interview is complete (Phase
          7).
        </p>
      )}
    </div>
  );
}
