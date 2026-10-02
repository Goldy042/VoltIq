import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { relations } from "./relations";

/**
 * One Postgres pool per server process. Neon accepts plain Postgres
 * connections, so the same driver works in production (use the pooled
 * DATABASE_URL) and against a local Postgres in development and tests —
 * and, unlike the HTTP driver, it supports transactions, which report
 * merging and rate limiting rely on.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzle({ client: pool, relations });
}

export type Db = ReturnType<typeof createDb>;

// Reuse the pool across hot reloads in development.
const globalForDb = globalThis as unknown as { voltiqDb?: Db };

export function getDb(): Db {
  globalForDb.voltiqDb ??= createDb();
  return globalForDb.voltiqDb;
}
