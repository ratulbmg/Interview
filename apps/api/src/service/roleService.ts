import { Role } from "@repo/db/client";
import { repositoryWrapper } from "../repository/repositoryWrapper";

class RoleService {
  async listRoles(): Promise<Role[]> {
    return repositoryWrapper.roleRepository.findAllOrdered();
  }
}

export default RoleService;
