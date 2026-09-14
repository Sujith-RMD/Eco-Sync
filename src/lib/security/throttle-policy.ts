/**
 * Sign-in throttling policy — pure, no I/O, no `server-only` import.
 *
 * Mirrors the `rules.ts` / `engine.ts` split: every decision lives here so it
 * can be unit-tested, and the database module is left as storage only.
 */

export interface ThrottlePolicy {
  /** Consecutive failures tolerated inside the window. */
  limit: number;
  /** Fixed window length in milliseconds. */
  windowMs: number;
}

export interface BudgetState {
  failures: number;
  /** Epoch millis at which the current window closes. */
  windowEndsAt: number;
}

export interface BudgetVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const SIGNIN_POLICIES = {
  /**
   * Guesses against ONE unit's access code before that unit is paused. This is
   * the control that actually protects a code, because it is attached to the
   * credential rather than to wherever the request came from.
   */
  teamCredential: { limit: 5, windowMs: 5 * 60_000 },
  /**
   * Backstop for one very noisy source address. It is deliberately far above
   * what a room full of honest typos costs: seventy-five units each mistyping
   * three times is 225 failures sharing one venue egress address, and none of
   * them may be locked out.
   *
   * Sized at 600 rather than 240 because the room grew: at 75 units, 240 left
   * only 15 failures of headroom, so one extra fat-fingered code per unit
   * (75 x 4 = 300) would have refused every unit for the rest of the window —
   * including the ones typing their code correctly. 600 absorbs eight typos
   * per unit. Raising this does not weaken code protection, which the
   * per-credential budget above owns.
   */
  teamSource: { limit: 600, windowMs: 5 * 60_000 },
  adminCredential: { limit: 5, windowMs: 10 * 60_000 },
  /** Operators are a handful of people, so a room-scale budget is unnecessary. */
  adminSource: { limit: 40, windowMs: 10 * 60_000 },
} satisfies Record<string, ThrottlePolicy>;

/**
 * Fixed-window decision. A missing row, or one whose window has already closed,
 * counts as an empty budget — stale rows must never keep a team out.
 */
export function evaluateBudget(
  state: BudgetState | null,
  nowMs: number,
  policy: ThrottlePolicy,
): BudgetVerdict {
  if (!state) return { allowed: true, retryAfterSeconds: 0 };
  if (state.windowEndsAt <= nowMs) return { allowed: true, retryAfterSeconds: 0 };
  if (state.failures < policy.limit) return { allowed: true, retryAfterSeconds: 0 };

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((state.windowEndsAt - nowMs) / 1000),
    ),
  };
}

/* Key builders — exported so call sites and tests cannot drift apart. */

export function teamCredentialKey(name: string): string {
  return `team-code:${name.trim().toLowerCase()}`;
}

export function adminCredentialKey(username: string): string {
  return `admin-pass:${username.trim().toLowerCase()}`;
}

export function sourceKey(ip: string): string {
  return `ip:${ip.trim().toLowerCase()}`;
}
