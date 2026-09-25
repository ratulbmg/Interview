/**
 * The three candidate-facing emails plus the one recruiter-facing email
 * (report-ready), as one discriminated union — the payload apps/api
 * enqueues (via client.ts) and this package's own BullMQ worker (worker.ts,
 * run as a process via start.ts) consumes.
 * Mirrored by hand as JSON Schema in
 * packages/shared-schemas/src/email-job.schema.json (schema.prisma-style
 * duplication: a queue payload crosses a process boundary the same way a
 * DB column does, so it needs the same kind of language-agnostic
 * description — see that file's header comment).
 */

export interface BaseEmailData {
  to: string;
  candidateName: string;
  roleName: string;
  /** ISO 8601 — the interview's InterviewSession.scheduledAt. */
  scheduledAt: string;
}

export interface MeetingLinkEmailData extends BaseEmailData {
  meetingUrl: string;
}

export interface ReportReadyEmailData {
  to: string;
  candidateName: string;
  roleName: string;
  sessionId: number;
  /** Absolute URL to the session's dashboard page. */
  sessionUrl: string;
}

export type EmailJob =
  | { type: "interview-invite"; data: BaseEmailData }
  | { type: "interview-followup"; data: BaseEmailData }
  | { type: "interview-meeting-link"; data: MeetingLinkEmailData }
  | { type: "report-ready"; data: ReportReadyEmailData };

export type EmailJobType = EmailJob["type"];
