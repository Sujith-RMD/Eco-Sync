import { describe, expect, it } from "vitest";
import {
  SIGNIN_POLICIES,
  adminCredentialKey,
  evaluateBudget,
  sourceKey,
  teamCredentialKey,
} from "@/lib/security/throttle-policy";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const TEAM = SIGNIN_POLICIES.teamCredential;

describe("evaluateBudget — fixed window", () => {
  it("allows a credential that has never failed", () => {
    expect(evaluateBudget(null, NOW, TEAM)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("allows failures below the limit", () => {
    const state = { failures: TEAM.limit - 1, windowEndsAt: NOW + 60_000 };
    expect(evaluateBudget(state, NOW, TEAM).allowed).toBe(true);
  });

  it("blocks exactly at the limit", () => {
    const state = { failures: TEAM.limit, windowEndsAt: NOW + 60_000 };
    expect(evaluateBudget(state, NOW, TEAM).allowed).toBe(false);
  });

  it("counts a stale window as empty, however large the stored failure count", () => {
    const state = { failures: 10_000, windowEndsAt: NOW - 1 };
    expect(evaluateBudget(state, NOW, TEAM)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("reports whole seconds remaining, never zero while blocking", () => {
    const state = { failures: TEAM.limit, windowEndsAt: NOW + 90_000 };
    const verdict = evaluateBudget(state, NOW, TEAM);
    expect(verdict.retryAfterSeconds).toBe(90);

    // One millisecond left still rounds up to a usable, non-zero wait.
    const edge = { failures: TEAM.limit, windowEndsAt: NOW + 1 };
    expect(evaluateBudget(edge, NOW, TEAM).retryAfterSeconds).toBe(1);
  });
});

describe("room-scale invariants", () => {
  /**
   * The regression this guards: the original limiter counted every attempt,
   * successfully or not, against one IP bucket of 10 per five minutes. Sixty
   * units behind one venue egress address were locked out by logging in.
   */
  it("gives the whole room headroom to mistype from one shared address", () => {
    const worstHonestRoom = 60 * 3; // sixty units, three typos each
    expect(worstHonestRoom).toBeLessThan(SIGNIN_POLICIES.teamSource.limit);
  });

  it("still caps guessing against a single access code", () => {
    expect(TEAM.limit).toBeLessThanOrEqual(5);
    expect(TEAM.limit).toBeGreaterThan(0);
  });

  it("pauses only the offending unit, not its neighbours", () => {
    const spentUnit = { failures: TEAM.limit, windowEndsAt: NOW + 60_000 };
    const innocentUnit = { failures: 0, windowEndsAt: NOW + 60_000 };
    const sharedAddress = {
      failures: 180,
      windowEndsAt: NOW + 60_000,
    };

    expect(evaluateBudget(spentUnit, NOW, TEAM).allowed).toBe(false);
    expect(evaluateBudget(innocentUnit, NOW, TEAM).allowed).toBe(true);
    expect(
      evaluateBudget(sharedAddress, NOW, SIGNIN_POLICIES.teamSource).allowed,
    ).toBe(true);
  });

  it("keeps the operator path strict while the room path is generous", () => {
    expect(SIGNIN_POLICIES.adminCredential.limit).toBeLessThanOrEqual(5);
    expect(SIGNIN_POLICIES.teamSource.limit).toBeGreaterThan(
      SIGNIN_POLICIES.adminSource.limit,
    );
  });
});

describe("budget keys", () => {
  it("normalizes case and padding so retries share one budget", () => {
    expect(teamCredentialKey("  UNIT-01 ")).toBe(teamCredentialKey("unit-01"));
    expect(adminCredentialKey(" Admin ")).toBe(adminCredentialKey("admin"));
    expect(sourceKey(" 203.0.113.9 ")).toBe(sourceKey("203.0.113.9"));
  });

  it("keeps credential and address budgets apart", () => {
    expect(teamCredentialKey("unit-01")).not.toBe(sourceKey("unit-01"));
    expect(adminCredentialKey("admin")).not.toBe(teamCredentialKey("admin"));
  });
});
