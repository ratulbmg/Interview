-- Candidates and roles become recruiter-scoped, the same way questions
-- already are (see 20260930090000_add_created_by_ownership) — each is now
-- owned by exactly one recruiter, never a shared cross-recruiter list.
--
-- Backfill: existing rows (created before this ownership model existed)
-- are attributed to the first recruiter account, exactly as the earlier
-- questions/sessions migration did. This is what keeps the two seeded
-- roles and any already-added candidates intact rather than deleted.

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "createdById" INTEGER;

UPDATE "candidates" SET "createdById" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "candidates" ALTER COLUMN "createdById" SET NOT NULL;

-- Email uniqueness moves from global to per-recruiter: two different
-- recruiters can each separately add a candidate who happens to share an
-- email, without conflicting.
DROP INDEX "candidates_email_key";

CREATE UNIQUE INDEX "candidates_email_createdById_key" ON "candidates"("email", "createdById");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "createdById" INTEGER;

UPDATE "roles" SET "createdById" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "roles" ALTER COLUMN "createdById" SET NOT NULL;

-- Name uniqueness moves from global to per-recruiter: two recruiters can
-- each have their own "Frontend Engineer" role.
DROP INDEX "roles_name_key";

CREATE UNIQUE INDEX "roles_name_createdById_key" ON "roles"("name", "createdById");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
