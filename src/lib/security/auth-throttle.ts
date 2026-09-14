import "server-only";
import { eq, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { authThrottle } from "@/db/schema";
import {
  adminCredentialKey,
  evaluateBudget,
  SIGNIN_POLICIES,
  sourceKey,
  teamCredentialKey,
  type BudgetState,
  type BudgetVerdict,
  type ThrottlePolicy,
} from "@/lib/security/throttle-policy";

export type SignInGuard = BudgetVerdict;

/**
 * Storage for the sign-in throttle. A read failure propagates: if this table is
 * unreachable, the credential lookup behind it will fail too, so there is no
 * useful degraded mode to invent — failing loudly is the honest behaviour.
 */

async function readBudget(key: string): Promise<BudgetState | null> {
  const [row] = await db
    .select({
      failures: authThrottle.failures,
      windowEndsAt: authThrottle.windowEndsAt,
    })
    .from(authThrottle)
    .where(eq(authThrottle.key, key));

  if (!row) return null;
  return { failures: row.failures, windowEndsAt: row.windowEndsAt.getTime() };
}

async function guardPair(
  credentialKey: string,
  ipKey: string | null,
  credentialPolicy: ThrottlePolicy,
  ipPolicy: ThrottlePolicy,
): Promise<SignInGuard> {
  const now = Date.now();
  const [credential, source] = await Promise.all([
    readBudget(credentialKey),
    ipKey ? readBudget(ipKey) : Promise.resolve(null),
  ]);

  const verdicts = [
    evaluateBudget(credential, now, credentialPolicy),
    evaluateBudget(source, now, ipPolicy),
  ];

  return (
    verdicts.find((v) => !v.allowed) ?? { allowed: true, retryAfterSeconds: 0 }
  );
}

/**
 * Records ONE failure for a key, rolling the window over if the stored one has
 * already expired. Written as a single atomic upsert so concurrent retries from
 * the same team cannot lose counts.
 */
async function recordFailure(key: string, policy: ThrottlePolicy): Promise<void> {
  const now = Date.now();
  const nextWindowEndsAt = new Date(now + policy.windowMs);
  const stale = lte(authThrottle.windowEndsAt, new Date(now));

  await db
    .insert(authThrottle)
    .values({ key, failures: 1, windowEndsAt: nextWindowEndsAt })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: {
        failures: sql`case when ${stale} then 1 else ${authThrottle.failures} + 1 end`,
        windowEndsAt: sql`case when ${stale} then ${nextWindowEndsAt} else ${authThrottle.windowEndsAt} end`,
      },
    });
}

/* ------------------------------- team sign-in ------------------------------ */

export async function guardTeamSignIn(
  teamName: string,
  ip: string | null,
): Promise<SignInGuard> {
  return guardPair(
    teamCredentialKey(teamName),
    ip ? sourceKey(ip) : null,
    SIGNIN_POLICIES.teamCredential,
    SIGNIN_POLICIES.teamSource,
  );
}

export async function recordTeamSignInFailure(
  teamName: string,
  ip: string | null,
): Promise<void> {
  await recordFailure(teamCredentialKey(teamName), SIGNIN_POLICIES.teamCredential);
  if (ip) {
    await recordFailure(sourceKey(ip), SIGNIN_POLICIES.teamSource);
    maybePruneExpired();
  }
}

/** A team that gets in has proven itself; forget its typo history. */
export async function noteTeamSignInSuccess(teamName: string): Promise<void> {
  await db
    .delete(authThrottle)
    .where(eq(authThrottle.key, teamCredentialKey(teamName)));
}

/* ------------------------------- admin sign-in ----------------------------- */

export async function guardAdminSignIn(
  username: string,
  ip: string | null,
): Promise<SignInGuard> {
  return guardPair(
    adminCredentialKey(username),
    ip ? sourceKey(ip) : null,
    SIGNIN_POLICIES.adminCredential,
    SIGNIN_POLICIES.adminSource,
  );
}

export async function recordAdminSignInFailure(
  username: string,
  ip: string | null,
): Promise<void> {
  await recordFailure(
    adminCredentialKey(username),
    SIGNIN_POLICIES.adminCredential,
  );
  if (ip) await recordFailure(sourceKey(ip), SIGNIN_POLICIES.adminSource);
}

export async function noteAdminSignInSuccess(username: string): Promise<void> {
  await db
    .delete(authThrottle)
    .where(eq(authThrottle.key, adminCredentialKey(username)));
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Rows expire on read, so pruning is hygiene only — it keeps a spoofed
 * `x-forwarded-for` header from accumulating one row per unique value.
 * Opportunistic and bounded: once every 64 recorded failures.
 */
let recordedSincePrune = 0;
function maybePruneExpired(): void {
  recordedSincePrune += 1;
  if (recordedSincePrune < 64) return;
  recordedSincePrune = 0;
  void db
    .delete(authThrottle)
    .where(lt(authThrottle.windowEndsAt, new Date()))
    .catch(() => undefined);
}
