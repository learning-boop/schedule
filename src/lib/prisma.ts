import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureSchema } from "@/lib/schema-guard";

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const base = new PrismaClient({ adapter });
  // Before the first query on this server instance, bring the database schema
  // up to date (new tables/columns are added if a migration hasn't been run).
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await ensureSchema(base);
        return query(args);
      },
    },
  });
}

type Client = ReturnType<typeof makeClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Client };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
