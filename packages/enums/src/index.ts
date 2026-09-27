/**
 * Shared enum definitions — the closed sets of values for fields whose
 * meaning is fixed across the whole product.
 *
 * This package has zero runtime dependencies on purpose: it must be safe to
 * import from a Node backend (apps/api, packages/mailer) and from a
 * browser bundle (apps/admin) alike, so nothing here can pull in
 * Prisma, `pg`, or any other Node-only package.
 *
 * These same enums are also declared as native `enum` blocks in
 * packages/db/prisma/schema.prisma, which is what makes Postgres itself
 * enforce a column's value. Prisma's schema file is its own DSL, not
 * TypeScript — it cannot import from this package — so the two declarations
 * must be kept in sync by hand (see packages/db/scripts/sync-enums.ts). If
 * you add, rename, or remove a value here, make the matching change in
 * schema.prisma (and run a migration) too.
 */

/**
 * An InterviewSession's lifecycle. SCHEDULED is the state a session is
 * created in (role + scheduledAt picked, but "Send Invite" not pressed
 * yet); INVITE_SENT is set the moment Send Invite is pressed — the
 * recruiter's last required action.
 */
export const InterviewSessionStatus = {
  SCHEDULED: "SCHEDULED",
  INVITE_SENT: "INVITE_SENT",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
} as const;
export type InterviewSessionStatus =
  (typeof InterviewSessionStatus)[keyof typeof InterviewSessionStatus];

export const QuestionDifficulty = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;
export type QuestionDifficulty =
  (typeof QuestionDifficulty)[keyof typeof QuestionDifficulty];
