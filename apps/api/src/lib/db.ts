import { prisma as dbPrisma, PrismaClient } from "@repo/db/client";

/**
 * Typed wrapper over `globalThis` to hold a development-only cached Prisma
 * client — keeps a single instance across nodemon restarts so dev doesn't
 * exhaust Postgres's connection limit.
 */
type GlobalPrisma = typeof globalThis & { prisma?: PrismaClient };
const globalForPrisma = globalThis as GlobalPrisma;

const prisma: PrismaClient = globalForPrisma.prisma ?? dbPrisma;

if (process.env.API_NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
