import { Question, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import prisma from "../lib/db";

class QuestionRepository extends BaseRepository<
  Question,
  Prisma.QuestionCreateInput,
  Prisma.QuestionUpdateInput
> {
  constructor() {
    super(prisma.question);
  }

  async findAllOrdered(): Promise<Question[]> {
    return prisma.question.findMany({ orderBy: { competency: "asc" } });
  }
}

export { QuestionRepository };
