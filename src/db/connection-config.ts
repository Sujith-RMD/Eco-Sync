import { SUPABASE_ROOT_CA_PEM } from "./supabase-root-ca";

/**
 * `ssl` is narrowed to the shape this module actually produces rather than
 * pg's own `boolean | ConnectionOptions` union, so callers and tests can read
 * `.ca` without asserting. It remains assignable to `PoolConfig["ssl"]`.
 */
export interface DbConnectionConfig {
  connectionString: string;
  ssl?: { ca: string };
}

/**
 * Build the pg connection config for a database URL.
 *
 * node-postgres parses `connectionString` *after* applying the config object, so
 * a query parameter in the URL overwrites the equivalent explicit option. The
 * Supabase endpoints Vercel hands out all carry `?sslmode=require`, and
 * `sslmode` maps to "verify against Node's own trust store" -- which silently
 * discards any `ca` passed alongside it. That is the whole reason a deployment
 * with a correct pinned root certificate still failed with
 * SELF_SIGNED_CERT_IN_CHAIN.
 *
 * So for Supabase hosts the parameter is removed and TLS is expressed solely
 * through the explicit `ssl` object, pinning Supabase's public root. Verified
 * against the live pooler: TLS completes and the server then rejects the
 * credentials (which is the expected outcome for a deliberately wrong
 * password). Without `ca`, the same server answers "SSL connection is required
 * for user", confirming TLS stays mandatory -- this pins trust, it never
 * downgrades it.
 *
 * Any other host is returned untouched so its connection string keeps governing
 * TLS. That preserves local development, where Postgres usually offers no TLS
 * at all and forcing it would break every query.
 */
export function buildDbConnectionConfig(connectionString: string): DbConnectionConfig {
  const hostname = safeHostname(connectionString);
  if (!/\.supabase\.(co|com)$/i.test(hostname)) {
    return { connectionString };
  }
  return {
    connectionString: withoutSslMode(connectionString),
    ssl: { ca: SUPABASE_ROOT_CA_PEM },
  };
}

/**
 * Drop only the `sslmode` parameter, keeping every other query argument and the
 * `?`/`&` punctuation valid. Done by splitting rather than by chained regexes:
 * a rewrite that deletes `sslmode=` and then tries to collapse the leftover
 * separator turns `?sslmode=disable&pool_min=1` into `db&pool_min=1`, which
 * silently corrupts a working connection string.
 */
export function withoutSslMode(url: string): string {
  const mark = url.indexOf("?");
  if (mark === -1) return url;
  const base = url.slice(0, mark);
  const kept = url
    .slice(mark + 1)
    .split("&")
    .filter((pair) => pair.length > 0 && !/^sslmode=/i.test(pair));
  return kept.length > 0 ? `${base}?${kept.join("&")}` : base;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
