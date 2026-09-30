import { Role } from "@repo/db/client";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { CreateRoleRequest } from "../model/roleModel";

class RoleService {
  async listRoles(userId: number): Promise<Role[]> {
    return repositoryWrapper.roleRepository.findAllOrderedForUser(userId);
  }

  /** Builds the actual blueprint from a flat list of competency names — the
   * fixed slots (opener, cv_probe, scenario, behavioral, candidate_questions)
   * are the same for every role in this product today (see
   * packages/db/src/seed.ts's two seeded blueprints); only which
   * core_competency slots sit between cv_probe and scenario actually
   * varies per role, so that's the only thing a recruiter picks here. */
  async createRole(data: CreateRoleRequest, userId: number): Promise<Role> {
    const blueprint = [
      { slot: "opener" },
      { slot: "cv_probe" },
      ...data.competencies.map((competency) => ({
        slot: "core_competency",
        competency,
      })),
      { slot: "scenario" },
      { slot: "behavioral" },
      { slot: "candidate_questions" },
    ];

    return repositoryWrapper.roleRepository.create({
      name: data.name,
      description: data.description,
      blueprint,
      createdBy: { connect: { id: userId } },
    });
  }
}

export default RoleService;
