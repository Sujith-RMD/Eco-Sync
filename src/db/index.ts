import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolConfig } from "pg";
import { Pool } from "pg";
import * as schema from "./schema";
import { SUPABASE_ROOT_CA_PEM } from "./supabase-root-ca";

/**
 * `||`, not `??`: Vercel's first-party Postgres publishes its endpoint as
 * `DATABASE_POSTGRES_URL` (plus `_NON_POOLING`) and leaves `DATABASE_URL`
 * untouched, while `vercel env pull`/`env run` mask storage variables as empty
 * strings. Accepting either name means the app connects on a deployment without
 * anyone having to duplicate a credential across two variable names, and an
 * empty-but-present `DATABASE_URL` correctly falls through instead of throwing.
 * Locally, `.env` still wins because `DATABASE_URL` is set there.
 */
const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_POSTGRES_URL is required");
}

/**
 * TLS trust for the database socket.
 *
 * Node ships its own CA store instead of using the operating system's, and
 * Supabase's poolers terminate TLS with a chain rooted in "Supabase Root 2021
 * CA", which Node does not carry and Windows does. Because node-postgres treats
 * `?sslmode=require` as full verification, every hosted query failed with
 * SELF_SIGNED_CERT_IN_CHAIN. Pinning that one public root keeps the socket
 * authenticated; turning verification off would have "worked" and silently
 * accepted any man in the middle between a serverless function and the ledger.
 *
 * Any other host is left alone so the connection string keeps governing TLS:
 * forcing `ssl` here would break local development, where Postgres usually
 * offers no TLS at all.
 */
function sslOptions(connectionString: string): PoolConfig["ssl"] {
  let hostname = "";
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    return undefined;
  }
  return /\.supabase\.(co|com)$/i.test(hostname)
    ? { ca: SUPABASE_ROOT_CA_PEM }
    : undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __ecosyncDbPool?: Pool;
};

/**
 * Single pooled connection, reused across hot reloads in development and
 * across invocations within the same serverless instance in production.
 */
export const pool =
  globalForDb.__ecosyncDbPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    ssl: sslOptions(databaseUrl),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ecosyncDbPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
