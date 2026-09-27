import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Label, Select } from "@repo/ui";
import type { BadgeProps } from "@repo/ui";
import { useListCandidatesQuery } from "../../redux/api/candidatesApi";
import { useListRolesQuery } from "../../redux/api/rolesApi";
import {
  useDeleteSessionMutation,
  useListSessionsQuery,
  useScheduleSessionMutation,
  useSendInviteMutation,
} from "../../redux/api/sessionsApi";

/** Grayscale palette (see globals.css) has no room for a full traffic-light
 * status system — this maps each status to the closest neutral meaning
 * instead: not yet acted on, actively moving, done, or didn't happen. */
const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  SCHEDULED: "secondary",
  INVITE_SENT: "default",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  NO_SHOW: "destructive",
  CANCELLED: "destructive",
};

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
  const [deleteSession] = useDeleteSessionMutation();

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

  const handleDelete = async (sessionId: number, label: string) => {
    const confirmed = window.confirm(`Delete the interview session for ${label}?`);
    if (!confirmed) return;
    await deleteSession(sessionId).unwrap();
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-semibold text-foreground">
          Schedule an interview
        </h1>
        <Card>
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3 p-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="candidate">Candidate</Label>
              <Select
                id="candidate"
                required
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
              >
                <option value="" disabled>
                  Select a candidate
                </option>
                {candidates?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="" disabled>
                  Select a role
                </option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Date &amp; time</Label>
              <input
                id="scheduledAt"
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button type="submit" disabled={isScheduling}>
              {isScheduling ? "Scheduling…" : "Schedule"}
            </Button>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Sessions
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Candidate</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions?.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-3 text-foreground">
                      {session.candidate.name ?? session.candidate.email}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {session.role.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(session.scheduledAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[session.status]}>
                        {session.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {session.status === "SCHEDULED" ? (
                          <Button
                            size="sm"
                            onClick={() => sendInvite(session.id)}
                            disabled={isSendingInvite}
                          >
                            Send Invite
                          </Button>
                        ) : (
                          <Link
                            to={`/sessions/${session.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </Link>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleDelete(
                              session.id,
                              session.candidate.name ?? session.candidate.email,
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions?.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
