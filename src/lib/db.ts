import { PrismaClient } from "@prisma/client";

// Singleton Prisma client (avoids exhausting connections during dev HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Cache the client on globalThis in every environment. In dev this avoids
// exhausting connections during HMR; on Vercel's Fluid Compute (which reuses
// warm function instances) it prevents opening a new pool on each invocation.
globalForPrisma.prisma = prisma;
