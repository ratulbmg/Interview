import { FormEvent, ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, buttonVariants, Card, Input, Label, Modal } from "@repo/ui";
import type { BadgeProps } from "@repo/ui";
import { useListCandidatesQuery } from "../../redux/api/candidatesApi";
import {
  Session,
  SessionStatus,
  useListSessionsQuery,
} from "../../redux/api/sessionsApi";
import { useListResultsQuery } from "../../redux/api/resultsApi";
import { useAddRoleMutation, useListRolesQuery } from "../../redux/api/rolesApi";

/** Same neutral-palette status mapping Sessions.tsx uses — duplicated
 * rather than imported since it's a small presentational lookup, not a
 * shared type, and this page has no other reason to reach into
 * Sessions.tsx's internals. */
const STATUS_VARIANT: Record<SessionStatus, NonNullable<BadgeProps["variant"]>> = {
  SCHEDULED: "secondary",
  INVITE_SENT: "default",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  NO_SHOW: "destructive",
  CANCELLED: "destructive",
};

const ALL_STATUSES: SessionStatus[] = [
  "SCHEDULED",
  "INVITE_SENT",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

// "Upcoming" is what hasn't happened yet; "recent" is what already has —
// a session doesn't move to IN_PROGRESS until the candidate actually
// joins, so SCHEDULED/INVITE_SENT is exactly "not started" and everything
// else is exactly "started or resolved."
const UPCOMING_STATUSES = new Set<SessionStatus>(["SCHEDULED", "INVITE_SENT"]);
const RECENT_STATUSES = new Set<SessionStatus>([
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

const RECENT_LIMIT = 5;
const UPCOMING_LIMIT = 5;

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

function SectionError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </p>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function candidateLabel(session: Session): string {
  return session.candidate.name ?? session.candidate.email;
}

/** Comma-separated free text in the form, a string array on the wire —
 * mirrors Questions.tsx's own parseList (kept local here since it's a
 * one-line presentational helper, not worth sharing across pages). */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const initialRoleForm = { name: "", description: "", competencies: "" };

/**
 * The recruiter's landing page — a read-only overview built entirely from
 * data the Candidates/Sessions/Results pages already fetch (see each
 * useList*Query below); no new endpoints beyond a small, additive
 * extension to /results (dimensionScores — see apps/api's lib/eligibility.ts)
 * to avoid discarding data it was already computing. Every number here is
 * either a plain count or an average of already-persisted 1-5 scores —
 * nothing is invented, and no scoring happens in this file.
 */
export default function Dashboard() {
  const {
    data: candidates,
    isLoading: candidatesLoading,
    isError: candidatesError,
  } = useListCandidatesQuery();
  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useListSessionsQuery();
  const {
    data: results,
    isLoading: resultsLoading,
    isError: resultsError,
  } = useListResultsQuery();
  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useListRolesQuery();
  const [addRole, { isLoading: isAddingRole, error: addRoleError }] =
    useAddRoleMutation();
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState(initialRoleForm);

  const closeRoleModal = () => {
    setRoleModalOpen(false);
    setRoleForm(initialRoleForm);
  };

  const handleAddRole = async (event: FormEvent) => {
    event.preventDefault();

    await addRole({
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      competencies: parseList(roleForm.competencies),
    }).unwrap();

    closeRoleModal();
  };

  const statusCounts = (sessions ?? []).reduce(
    (acc, session) => {
      acc[session.status] = (acc[session.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<SessionStatus, number>,
  );

  const scheduledCount =
    (statusCounts.SCHEDULED ?? 0) + (statusCounts.INVITE_SENT ?? 0);
  const completedCount = statusCounts.COMPLETED ?? 0;
  const inProgressCount = statusCounts.IN_PROGRESS ?? 0;

  // Scores are 1-5 everywhere in this product (see apps/engine's
  // agent/scoring/schemas.py) — overallPercentage only exists because the
  // Results page needs a threshold to compare against 80. Converting back
  // (÷20) keeps this page on the same scale as the rest of the app instead
  // of introducing a second representation.
  const avgScore =
    results && results.length > 0
      ? results.reduce((sum, r) => sum + r.overallPercentage, 0) /
        results.length /
        20
      : null;

  const resultBySessionId = new Map(
    (results ?? []).map((r) => [r.sessionId, r]),
  );

  const recentInterviews = (sessions ?? [])
    .filter((s) => RECENT_STATUSES.has(s.status))
    .slice(0, RECENT_LIMIT); // already ordered scheduledAt desc by the API

  // A lazy useState initializer (not a bare Date.now() call) so render
  // stays pure — this only ever reads the wall clock once, at mount, which
  // is fine: a dashboard's "upcoming" list doesn't need to be exact to the
  // millisecond on every re-render.
  const [now] = useState(() => Date.now());
  const upcomingInterviews = (sessions ?? [])
    .filter(
      (s) =>
        UPCOMING_STATUSES.has(s.status) &&
        new Date(s.scheduledAt).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, UPCOMING_LIMIT);

  const dimensionAverages = (() => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const result of results ?? []) {
      for (const d of result.dimensionScores) {
        const entry = totals.get(d.dimension) ?? { sum: 0, count: 0 };
        entry.sum += d.score;
        entry.count += 1;
        totals.set(d.dimension, entry);
      }
    }
    return Array.from(totals.entries()).map(([dimension, { sum, count }]) => ({
      dimension,
      average: sum / count,
    }));
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your interviews and candidate pipeline.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Candidates"
          value={
            candidatesLoading || candidatesError
              ? "—"
              : (candidates?.length ?? 0)
          }
        />
        <StatCard
          label="Scheduled"
          value={sessionsLoading || sessionsError ? "—" : scheduledCount}
        />
        <StatCard
          label="Completed"
          value={sessionsLoading || sessionsError ? "—" : completedCount}
        />
        <StatCard
          label="In Progress"
          value={sessionsLoading || sessionsError ? "—" : inProgressCount}
        />
        <StatCard
          label="Avg. Score"
          value={
            resultsLoading || resultsError
              ? "—"
              : avgScore !== null
                ? `${avgScore.toFixed(1)} / 5`
                : "—"
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Interview Activity
          </h2>
          <Card className="divide-y divide-border p-0">
            {sessionsLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : sessionsError ? (
              <div className="p-4">
                <SectionError message="Could not load interview activity." />
              </div>
            ) : sessions && sessions.length > 0 ? (
              ALL_STATUSES.map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                  <span className="text-sm font-medium text-foreground">
                    {statusCounts[status] ?? 0}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4">
                <EmptyState message="No interviews yet. Schedule your first interview to start seeing activity." />
              </div>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Upcoming Interviews
          </h2>
          <Card className="divide-y divide-border p-0">
            {sessionsLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : sessionsError ? (
              <div className="p-4">
                <SectionError message="Could not load upcoming interviews." />
              </div>
            ) : upcomingInterviews.length > 0 ? (
              upcomingInterviews.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {candidateLabel(session)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.role.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground">
                      {new Date(session.scheduledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.scheduledAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4">
                <EmptyState message="No upcoming interviews." />
              </div>
            )}
          </Card>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent Interviews
        </h2>
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessionsError ? (
          <SectionError message="Could not load recent interviews." />
        ) : recentInterviews.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Candidate</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentInterviews.map((session) => {
                  const result = resultBySessionId.get(session.id);
                  return (
                    <tr key={session.id}>
                      <td className="px-4 py-3 text-foreground">
                        {candidateLabel(session)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {session.role.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(session.scheduledAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[session.status]}>
                          {session.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {result
                          ? `${(result.overallPercentage / 20).toFixed(1)} / 5`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/sessions/${session.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No interviews yet. Schedule your first interview to start seeing activity." />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Recent Evaluation Performance
        </h2>
        {resultsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : resultsError ? (
          <SectionError message="Could not load evaluation performance." />
        ) : dimensionAverages.length > 0 ? (
          <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            {dimensionAverages.map(({ dimension, average }) => (
              <div key={dimension}>
                <p className="text-xs capitalize text-muted-foreground">
                  {dimension.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {average.toFixed(1)} / 5
                </p>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState message="No evaluation results yet." />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Saved Roles
        </h2>
        {rolesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rolesError ? (
          <SectionError message="Could not load roles." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles?.map((role) => {
              const competencies = role.blueprint
                .filter((slot) => slot.slot === "core_competency")
                .map((slot) => slot.competency)
                .filter((c): c is string => Boolean(c));
              return (
                <Card key={role.id} className="p-4">
                  <p className="font-medium text-foreground">{role.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {role.description}
                  </p>
                  {competencies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {competencies.map((c) => (
                        <Badge key={c} variant="outline">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="flex min-h-26 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <span className="text-lg leading-none">+</span>
              Add new role
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/candidates"
            className={buttonVariants({ variant: "secondary" })}
          >
            Add Candidate
          </Link>
          <Link
            to="/sessions"
            className={buttonVariants({ variant: "secondary" })}
          >
            Schedule Interview
          </Link>
          <Link
            to="/questions"
            className={buttonVariants({ variant: "secondary" })}
          >
            View Questions
          </Link>
        </div>
      </section>

      <Modal
        open={roleModalOpen}
        onClose={closeRoleModal}
        title="Add new role"
        className="max-w-xl"
      >
        <form onSubmit={handleAddRole} className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="roleName">Role name</Label>
            <Input
              id="roleName"
              required
              placeholder="e.g. Data Engineer"
              value={roleForm.name}
              onChange={(e) =>
                setRoleForm({ ...roleForm, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roleDescription">Description</Label>
            <textarea
              id="roleDescription"
              required
              rows={2}
              placeholder="e.g. Builds and operates the product's data pipelines."
              value={roleForm.description}
              onChange={(e) =>
                setRoleForm({ ...roleForm, description: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roleCompetencies">
              Core competencies (comma-separated)
            </Label>
            <Input
              id="roleCompetencies"
              required
              placeholder="e.g. SQL, ETL, Data Modeling"
              value={roleForm.competencies}
              onChange={(e) =>
                setRoleForm({ ...roleForm, competencies: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Each one becomes a dedicated question slot in this role's
              interview blueprint.
            </p>
          </div>

          {addRoleError && (
            <p className="text-sm text-destructive">
              {"data" in addRoleError &&
              typeof addRoleError.data === "object" &&
              addRoleError.data &&
              "message" in addRoleError.data
                ? String((addRoleError.data as { message?: string }).message)
                : "Could not add role."}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeRoleModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAddingRole}>
              {isAddingRole ? "Saving…" : "Save role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
