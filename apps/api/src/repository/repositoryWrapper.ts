import { UserRepository } from "./userRepository";
import { CandidateRepository } from "./candidateRepository";
import { RoleRepository } from "./roleRepository";
import { QuestionRepository } from "./questionRepository";
import { SessionRepository } from "./sessionRepository";

class RepositoryWrapper {
  userRepository: UserRepository;
  candidateRepository: CandidateRepository;
  roleRepository: RoleRepository;
  questionRepository: QuestionRepository;
  sessionRepository: SessionRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.candidateRepository = new CandidateRepository();
    this.roleRepository = new RoleRepository();
    this.questionRepository = new QuestionRepository();
    this.sessionRepository = new SessionRepository();
  }
}

export const repositoryWrapper = new RepositoryWrapper();
