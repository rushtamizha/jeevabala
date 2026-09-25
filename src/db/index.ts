import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

const globalForDb = globalThis as unknown as { __saarathiPool?: Pool; __saarathiDb?: Database };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure it.");
  }
  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Guard against runaway queries holding connections.
    statement_timeout: 15_000,
    application_name: "saarathi-web",
  };
  if (process.env.DB_SSL === "true") {
    config.ssl = { rejectUnauthorized: process.env.DB_SSL_ALLOW_SELF_SIGNED !== "true" };
  }
  const pool = new Pool(config);
  pool.on("error", (err) => {
    // An idle client errored (e.g. DB restart). The pool will replace it.
    console.error("[db] idle client error:", err.message);
  });
  return pool;
}

function getDb(): Database {
  if (!globalForDb.__saarathiDb) {
    const pool = globalForDb.__saarathiPool ?? createPool();
    globalForDb.__saarathiPool = pool;
    globalForDb.__saarathiDb = drizzle(pool, { schema });
  }
  return globalForDb.__saarathiDb;
}

/**
 * Lazily-initialised database handle. The pool is created on first use so that
 * importing this module never requires env vars (e.g. during `next build`).
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function closeDb() {
  await globalForDb.__saarathiPool?.end();
  globalForDb.__saarathiPool = undefined;
  globalForDb.__saarathiDb = undefined;
}

export { schema };
