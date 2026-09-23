import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useListCandidatesQuery } from "../../redux/api/candidatesApi";
import { useListRolesQuery } from "../../redux/api/rolesApi";
import {
  useListSessionsQuery,
  useScheduleSessionMutation,
  useSendInviteMutation,
} from "../../redux/api/sessionsApi";

/**
 * Scheduling (pick a candidate, a role, a date/time) and sending the
 * invite are two separate actions — see packages/db/prisma/schema.prisma's
 * InterviewSessionStatus: a session sits at SCHEDULED until its row's
 * "Send Invite" button is pressed, which is the recruiter's last required
 * action (see apps/api's sessionService.sendInvite).
 */
export default function Sessions() {
  const { data: candidates } = useListCandidatesQuery();
  const { data: roles } = useListRolesQuery();
  const { data: sessions, isLoading } = useListSessionsQuery();
  const [scheduleSession, { isLoading: isScheduling }] =
    useScheduleSessionMutation();
  const [sendInvite, { isLoading: isSendingInvite }] = useSendInviteMutation();

  const [candidateId, setCandidateId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await scheduleSession({
      candidateId: Number(candidateId),
      roleId: Number(roleId),
      scheduledAt: new Date(scheduledAt).toISOString(),
    }).unwrap();
    setCandidateId("");
    setRoleId("");
    setScheduledAt("");
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-semibold">Schedule an interview</h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
        >
          <div className="space-y-1">
            <label className="block text-sm text-gray-600" htmlFor="candidate">
              Candidate
            </label>
            <select
              id="candidate"
              required
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a candidate
              </option>
              {candidates?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm text-gray-600" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a role
              </option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="block text-sm text-gray-600"
              htmlFor="scheduledAt"
            >
              Date &amp; time
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isScheduling}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isScheduling ? "Scheduling…" : "Schedule"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Sessions</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Candidate</th>
                <th className="py-2">Role</th>
                <th className="py-2">Scheduled</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions?.map((session) => (
                <tr key={session.id} className="border-b border-gray-100">
                  <td className="py-2">
                    {session.candidate.name ?? session.candidate.email}
                  </td>
                  <td className="py-2">{session.role.name}</td>
                  <td className="py-2">
                    {new Date(session.scheduledAt).toLocaleString()}
                  </td>
                  <td className="py-2">{session.status}</td>
                  <td className="py-2 text-right">
                    {session.status === "SCHEDULED" ? (
                      <button
                        onClick={() => sendInvite(session.id)}
                        disabled={isSendingInvite}
                        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Send Invite
                      </button>
                    ) : (
                      <Link
                        to={`/sessions/${session.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {sessions?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
