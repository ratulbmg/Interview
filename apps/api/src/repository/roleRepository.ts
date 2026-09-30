import { Role, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import prisma from "../lib/db";

class RoleRepository extends BaseRepository<
  Role,
  Prisma.RoleCreateInput,
  Prisma.RoleUpdateInput
> {
  constructor() {
    super(prisma.role);
  }

  /** Each recruiter has their own roles — there's no shared, cross-recruiter
   * list (see packages/db/prisma/schema.prisma's Role.createdBy). */
  async findAllOrderedForUser(userId: number): Promise<Role[]> {
    return prisma.role.findMany({
      where: { createdById: userId },
      orderBy: { name: "asc" },
    });
  }

  /** Name is only unique per recruiter now, not globally — used by
   * agent/interview/agent_data_client.py's get_role_by_name (the standalone
   * legacy_cli tool only; the live agent-start job looks roles up by id). */
  async findByName(name: string, userId: number): Promise<Role | null> {
    return prisma.role.findFirst({ where: { name, createdById: userId } });
  }

  /** Ownership check for scheduling a session — a role that exists but
   * belongs to another recruiter is treated exactly like one that doesn't
   * exist (see sessionService.scheduleSession). */
  async findByIdForUser(id: number, userId: number): Promise<Role | null> {
    return prisma.role.findFirst({ where: { id, createdById: userId } });
  }
}

export { RoleRepository };
