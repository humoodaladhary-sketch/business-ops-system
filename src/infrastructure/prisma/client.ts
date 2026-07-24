import { PrismaClient } from "@prisma/client";

// Resolve the Postgres connection string. Supports both a hand-set DATABASE_URL
// and the variables the Vercel ↔ Supabase integration injects automatically
// (POSTGRES_PRISMA_URL = pooled, POSTGRES_URL_NON_POOLING = direct), so the app
// connects out-of-the-box once Supabase is linked in Vercel.
const connectionUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  undefined;

// Singleton to survive Next.js hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
    ...(connectionUrl ? { datasources: { db: { url: connectionUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True when a database connection is configured (vs demo mode). */
export const hasDatabase = Boolean(connectionUrl);
