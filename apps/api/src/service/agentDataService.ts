import { Prisma } from "@repo/db/client";
import { apiError } from "../utils/apiError";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { AgentDataRequest } from "../validation";

/**
 * apps/engine has no database connection of its own — this is the only
 * place it ever reads or writes anything in Postgres, one action per case
 * below (see routes/agentRoute.ts's POST /agent/data). Each action here is
 * a direct port of a function that used to live in apps/engine's own
 * agent/interview/db.py, talking straight to Postgres via psycopg — that
 * module is now an HTTP client to this one endpoint instead.
 */
class AgentDataService {
  async handle(request: AgentDataRequest): Promise<unknown> {
    switch (request.action) {
      case "getUserIdByEmail": {
        const user = await repositoryWrapper.userRepository.findUser({
          email: request.email,
        });
        if (!user) {
          throw new apiError(`No user with email "${request.email}"`, 404);
        }
        return { id: user.id };
      }

      case "getRoleByName": {
        const role = await repositoryWrapper.roleRepository.findByName(
          request.name,
          request.createdById,
        );
        if (!role) {
          throw new apiError(`No role named "${request.name}"`, 404);
        }
        return role;
      }

      case "getRoleById": {
        const role = await repositoryWrapper.roleRepository.findById(
          request.roleId,
        );
        if (!role) {
          throw new apiError(`No role with id ${request.roleId}`, 404);
        }
        return role;
      }

      case "getCandidateById": {
        const candidate =
          await repositoryWrapper.candidateRepository.findById(
            request.candidateId,
          );
        if (!candidate) {
          throw new apiError(
            `No candidate with id ${request.candidateId}`,
            404,
          );
        }
        return candidate;
      }

      case "saveCandidateCvParsed": {
        await repositoryWrapper.candidateRepository.update(
          request.candidateId,
          {
            cvParsedJson: request.cvParsedJson as unknown as Prisma.InputJsonValue,
          },
        );
        return null;
      }

      case "getQuestions": {
        const questions =
          await repositoryWrapper.questionRepository.findAllForUserWithEmbedding(
            request.createdById,
          );
        return { questions };
      }

      case "saveQuestionEmbedding": {
        await repositoryWrapper.questionRepository.saveEmbedding(
          request.questionId,
          request.embedding,
        );
        return null;
      }

      case "markQuestionsAsked": {
        await repositoryWrapper.questionRepository.markAsked(
          request.questionIds,
        );
        return null;
      }
    }
  }
}

export default AgentDataService;
