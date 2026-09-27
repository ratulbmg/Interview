/**
 * JSON Schema definitions shared across process boundaries that can't share
 * a TypeScript type directly — e.g. the EmailJob union (apps/api enqueues,
 * packages/mailer's own worker consumes) and the agent-start job payload
 * (apps/api enqueues, apps/engine — a separate Python process —
 * consumes).
 *
 * Populated starting Phase 4 (packages/mailer) and Phase 5 (the scheduler's
 * agent-start job).
 */

export {};
