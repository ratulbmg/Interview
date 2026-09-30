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

  /** Every recruiter, with a count of what each one has created — backs
   * the Users page (see userService.ts). There's no admin/non-admin
   * distinction on User yet, so this is intentionally unscoped, unlike
   * Candidate/Role/Question/InterviewSession. */
  async findAllWithCounts() {
    return prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            candidates: true,
            roles: true,
            questions: true,
            sessions: true,
          },
        },
      },
    });
  }
}

export { UserRepository };
