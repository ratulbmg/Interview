/**
 * Shared enum definitions — the closed sets of values for fields whose
 * meaning is fixed across the whole product (session status, role
 * blueprint slot types, etc.).
 *
 * This package has zero runtime dependencies on purpose: it must be safe to
 * import from a Node backend (apps/api, apps/email-worker) and from a
 * browser bundle (apps/dashboard) alike, so nothing here can pull in
 * Prisma, `pg`, or any other Node-only package.
 *
 * Populated in Phase 1 (packages/db data layer) — its values are mirrored
 * by hand as native `enum` blocks in packages/db/prisma/schema.prisma (see
 * packages/db/scripts/sync-enums.ts), which is what makes Postgres itself
 * enforce a column's value.
 */

export {};
