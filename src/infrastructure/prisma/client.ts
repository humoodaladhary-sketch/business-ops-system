import { PrismaClient } from "@prisma/client";

// Singleton to survive Next.js hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True when a database connection is configured (vs demo mode). */
export const hasDatabase = Boolean(process.env.DATABASE_URL);
