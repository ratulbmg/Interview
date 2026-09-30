import AuthService from "./authService";
import CandidateService from "./candidateService";
import RoleService from "./roleService";
import QuestionService from "./questionService";
import SessionService from "./sessionService";
import AgentDataService from "./agentDataService";
import UserService from "./userService";

const authService = new AuthService();
const candidateService = new CandidateService();
const roleService = new RoleService();
const questionService = new QuestionService();
const sessionService = new SessionService();
const agentDataService = new AgentDataService();
const userService = new UserService();

export {
  authService,
  candidateService,
  roleService,
  questionService,
  sessionService,
  agentDataService,
  userService,
};
