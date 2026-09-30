import { UserSummary } from "../model/userModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";

class UserService {
  async listUsers(): Promise<UserSummary[]> {
    const users = await repositoryWrapper.userRepository.findAllWithCounts();

    return users.map((user) => ({
      id: user.id,
      uniqueId: user.uniqueId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      candidatesCount: user._count.candidates,
      rolesCount: user._count.roles,
      questionsCount: user._count.questions,
      sessionsCount: user._count.sessions,
    }));
  }
}

export default UserService;
