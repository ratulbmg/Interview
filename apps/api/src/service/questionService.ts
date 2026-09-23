import { Question } from "@repo/db/client";
import { repositoryWrapper } from "../repository/repositoryWrapper";

class QuestionService {
  async listQuestions(): Promise<Question[]> {
    return repositoryWrapper.questionRepository.findAllOrdered();
  }
}

export default QuestionService;
