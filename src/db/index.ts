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
 *
 * `max: 3`, not 10. This runs on Vercel, where every concurrent function
 * instance opens *its own* pool: 10 per instance multiplied by the dozens of
 * instances 60 units polling every few seconds can summon is how a game reaches
 * Supabase's connection ceiling at exactly the moment it matters — mid-round,
 * with everyone submitting at once. Three is enough for a single instance,
 * because each request here is a handful of short queries, and it keeps the
 * aggregate (instances x 3) inside the pooler's budget.
 *
 * Transaction-mode pooling (port 6543) is compatible with this application: the
 * codebase uses no `SET LOCAL`, advisory locks, `LISTEN`/`NOTIFY` or named
 * prepared statements, and every `db.transaction()` opens and commits inside one
 * call, which is what PgBouncer pins a server connection for.
 *
 * `connectionTimeoutMillis` fails a starved request in 10s instead of letting it
 * hang until the platform kills the function: a fast, honest error — and a
 * `db: "down"` health response — beats a spinner nobody ever escapes.
 */
export const pool =
  globalForDb.__ecosyncDbPool ??
  new Pool({
    ...connection,
    max: 3,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ecosyncDbPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
