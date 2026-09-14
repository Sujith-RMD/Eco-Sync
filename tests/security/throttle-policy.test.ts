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
   * teams behind one venue egress address were locked out by logging in.
   */
  it("gives the whole room headroom to mistype from one shared address", () => {
    // Seventy-five teams is the room size the live event runs at.
    const worstHonestRoom = 75 * 3;
    expect(worstHonestRoom).toBeLessThan(SIGNIN_POLICIES.teamSource.limit);
  });

  it("absorbs a fourth typo per team without refusing the room", () => {
    // The margin the old 240 ceiling did not have: 75 x 4 = 300 exceeded it.
    expect(75 * 4).toBeLessThan(SIGNIN_POLICIES.teamSource.limit);
  });

  it("still caps guessing against a single access code", () => {
    expect(TEAM.limit).toBeLessThanOrEqual(5);
    expect(TEAM.limit).toBeGreaterThan(0);
  });

  it("pauses only the offending team, not its neighbours", () => {
    const spentTeam = { failures: TEAM.limit, windowEndsAt: NOW + 60_000 };
    const innocentTeam = { failures: 0, windowEndsAt: NOW + 60_000 };
    const sharedAddress = {
      failures: 180,
      windowEndsAt: NOW + 60_000,
    };

    expect(evaluateBudget(spentTeam, NOW, TEAM).allowed).toBe(false);
    expect(evaluateBudget(innocentTeam, NOW, TEAM).allowed).toBe(true);
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
    // The real designation carries a '#', so normalization must not mangle it.
    expect(teamCredentialKey("  TEAM#8210 ")).toBe(teamCredentialKey("team#8210"));
    expect(adminCredentialKey(" Admin ")).toBe(adminCredentialKey("admin"));
    expect(sourceKey(" 203.0.113.9 ")).toBe(sourceKey("203.0.113.9"));
  });

  it("keeps credential and address budgets apart", () => {
    expect(teamCredentialKey("team#8210")).not.toBe(sourceKey("team#8210"));
    expect(adminCredentialKey("admin")).not.toBe(teamCredentialKey("admin"));
  });
});
