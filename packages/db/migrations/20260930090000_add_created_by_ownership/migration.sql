-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "createdById" INTEGER;

-- Backfill: questions/sessions created before per-recruiter ownership
-- existed are attributed to the first recruiter account, so the column can
-- be made required. Safe as long as at least one user row exists before
-- this runs (true for any database seeded via packages/db/src/seed.ts,
-- which creates the recruiter before any roles/questions/sessions).
UPDATE "questions" SET "createdById" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1);

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "createdById" SET NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "createdById" INTEGER;

UPDATE "sessions" SET "createdById" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1);

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "createdById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
