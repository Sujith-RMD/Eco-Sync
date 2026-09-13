import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { buildDbConnectionConfig } from "./connection-config";

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
 * TLS trust is resolved in ./connection-config, not here: node-postgres lets a
 * connection string's `sslmode` override an explicit `ssl` option, so pinning
 * Supabase's root requires removing that parameter. Getting this wrong fails
 * every query with SELF_SIGNED_CERT_IN_CHAIN, which is why it lives in a pure,
 * unit-tested module instead of inline.
 */
const connection = buildDbConnectionConfig(databaseUrl);

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
    ...connection,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ecosyncDbPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
