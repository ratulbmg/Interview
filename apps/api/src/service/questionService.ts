import { Question } from "@repo/db/client";
import { apiError } from "../utils/apiError";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { CreateQuestionRequest, UpdateQuestionRequest } from "../model/questionModel";

class QuestionService {
  async listQuestions(userId: number): Promise<Question[]> {
    return repositoryWrapper.questionRepository.findAllOrderedForUser(userId);
  }

  async createQuestion(
    data: CreateQuestionRequest,
    userId: number,
  ): Promise<Question> {
    return repositoryWrapper.questionRepository.create({
      text: data.text,
      competency: data.competency,
      difficulty: data.difficulty,
      tags: data.tags,
      questionType: data.questionType,
      objective: data.objective ?? null,
      expectedSignals: data.expectedSignals,
      maxFollowups: data.maxFollowups,
      maxDurationSeconds: data.maxDurationSeconds,
      createdBy: { connect: { id: userId } },
    });
  }

  /** `data` is passed straight through as Prisma update data — a field
   * left out of the request body comes through as `undefined`, which
   * Prisma's own client already treats as "don't touch this column," so
   * an omitted field never overwrites the existing value with a default
   * (see validation/questionValidation.ts's updateQuestionSchema comment). */
  async updateQuestion(
    id: number,
    data: UpdateQuestionRequest,
    userId: number,
  ): Promise<Question> {
    await this.findOwnedOrThrow(id, userId);
    return repositoryWrapper.questionRepository.update(id, data);
  }

  async deleteQuestion(id: number, userId: number): Promise<void> {
    await this.findOwnedOrThrow(id, userId);
    await repositoryWrapper.questionRepository.delete(id);
  }

  /** A question that exists but belongs to another recruiter is treated
   * identically to one that doesn't exist — never lets a recruiter learn
   * anything about another recruiter's bank, including whether a given id
   * is even in use. */
  private async findOwnedOrThrow(
    id: number,
    userId: number,
  ): Promise<Question> {
    const question = await repositoryWrapper.questionRepository.findByIdForUser(
      id,
      userId,
    );
    if (!question) {
      throw new apiError("Question not found", 404);
    }
    return question;
  }
}

export default QuestionService;
