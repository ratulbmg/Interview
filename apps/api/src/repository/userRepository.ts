import { User, Prisma } from "@repo/db/client";
import { BaseRepository } from "./baseRepository";
import prisma from "../lib/db";

class UserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor() {
    super(prisma.user);
  }

  async findUser(where: Partial<User>): Promise<User | null> {
    return prisma.user.findFirst({ where });
  }
}

export { UserRepository };
