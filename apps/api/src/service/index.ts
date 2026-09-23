import AuthService from "./authService";
import CandidateService from "./candidateService";
import RoleService from "./roleService";
import QuestionService from "./questionService";
import SessionService from "./sessionService";

const authService = new AuthService();
const candidateService = new CandidateService();
const roleService = new RoleService();
const questionService = new QuestionService();
const sessionService = new SessionService();

export {
  authService,
  candidateService,
  roleService,
  questionService,
  sessionService,
};
