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

  async findAllOrdered(): Promise<Role[]> {
    return prisma.role.findMany({ orderBy: { name: "asc" } });
  }
}

export { RoleRepository };
