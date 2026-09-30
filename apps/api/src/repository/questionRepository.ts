import { Question, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import prisma from "../lib/db";

/** Question.embedding is declared `Unsupported("vector(768)")` in
 * schema.prisma — a pgvector column Prisma's typed client can't select,
 * filter, or write at all. Every method touching it below drops to
 * $queryRaw/$executeRaw instead; this is the only place in apps/api that
 * ever talks to that column. */
export interface QuestionWithEmbedding {
  id: number;
  text: string;
  competency: string;
  difficulty: string;
  tags: string[];
  embedding: number[] | null;
  timesAsked: number;
  lastAskedAt: Date | null;
  questionType: string;
  objective: string | null;
  expectedSignals: string[];
  maxFollowups: number;
  maxDurationSeconds: number;
}

function toVectorText(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function parseVectorText(raw: string | null): number[] | null {
  if (raw === null) {
    return null;
  }
  return raw
    .slice(1, -1)
    .split(",")
    .map(Number);
}

class QuestionRepository extends BaseRepository<
  Question,
  Prisma.QuestionCreateInput,
  Prisma.QuestionUpdateInput
> {
  constructor() {
    super(prisma.question);
  }

  /** Each recruiter only ever sees the questions they added — there's no
   * shared, cross-recruiter bank (see packages/db/prisma/schema.prisma's
   * Question.createdBy). */
  async findAllOrderedForUser(userId: number): Promise<Question[]> {
    return prisma.question.findMany({
      where: { createdById: userId },
      orderBy: { competency: "asc" },
    });
  }

  /** The one method that needs `embedding` — used exclusively by
   * agentDataService's "getQuestions" action, apps/engine's replacement for
   * its old direct-Postgres db.get_questions. `embedding::text` asks
   * Postgres itself to stringify the vector (pgvector's own bracketed
   * "[0.1,0.2,...]" text form) since there's no JS-side pgvector codec here
   * — parseVectorText below just splits that string back into numbers. */
  async findAllForUserWithEmbedding(
    userId: number,
  ): Promise<QuestionWithEmbedding[]> {
    const rows = await prisma.$queryRaw<
      Array<Omit<QuestionWithEmbedding, "embedding"> & { embedding: string | null }>
    >`
      SELECT id, text, competency, difficulty, tags, embedding::text AS embedding, "timesAsked", "lastAskedAt",
        "questionType", objective, "expectedSignals", "maxFollowups", "maxDurationSeconds"
      FROM questions
      WHERE "createdById" = ${userId}
    `;
    return rows.map((row) => ({
      ...row,
      embedding: parseVectorText(row.embedding),
    }));
  }

  /** Lazily backfills an embedding apps/engine computed on the fly (the
   * question bank starts with no embeddings — see packages/db/src/seed.ts).
   * Raw SQL for the same reason as findAllForUserWithEmbedding above. */
  async saveEmbedding(questionId: number, embedding: number[]): Promise<void> {
    const vectorText = toVectorText(embedding);
    await prisma.$executeRaw`
      UPDATE questions SET embedding = ${vectorText}::vector WHERE id = ${questionId}
    `;
  }

  /** Ownership check for PATCH/DELETE — a question that exists but belongs
   * to a different recruiter is treated exactly like one that doesn't
   * exist at all (see questionService.ts), so this returns null for both
   * cases rather than letting a caller tell them apart. */
  async findByIdForUser(id: number, userId: number): Promise<Question | null> {
    return prisma.question.findFirst({ where: { id, createdById: userId } });
  }

  async markAsked(questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) {
      return;
    }
    await prisma.question.updateMany({
      where: { id: { in: questionIds } },
      data: { timesAsked: { increment: 1 }, lastAskedAt: new Date() },
    });
  }
}

export { QuestionRepository };
