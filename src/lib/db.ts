import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "@/db/schema";
const globalDb = globalThis as unknown as { consolePool?: Pool };
export const pool =
  globalDb.consolePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalDb.consolePool = pool;
if (process.env.VERCEL) attachDatabasePool(pool);
export const db = drizzle(pool, { schema });
