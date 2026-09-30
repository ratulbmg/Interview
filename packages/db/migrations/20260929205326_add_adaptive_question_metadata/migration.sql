-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('ROLE', 'CV_BASED', 'GAP', 'SCENARIO', 'BEHAVIORAL');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "expectedSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxDurationSeconds" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "maxFollowups" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "questionType" "QuestionType" NOT NULL DEFAULT 'ROLE';
