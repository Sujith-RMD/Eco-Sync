import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Participant/admin separation, checked at the source level.
 *
 * The requirement is that standings are never reachable from the team-facing
 * app — not that they are visually hidden. A test that rendered a component and
 * looked for a link would only prove the current markup; this asserts the weaker
 * but more durable property: no participant surface references the route at all,
 * and the historical route no longer holds a query, so there is nothing to leak
 * even if someone later re-links it.
 */

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function sourcesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourcesIn(path));
    } else if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
      out.push(path);
    }
  }
  return out;
}

/** Every file a signed-in team can be shown, chrome included. */
const PARTICIPANT_SURFACES = [
  "src/app/team",
  "src/app/lobby",
  "src/app/login",
  "src/components/team",
  "src/components/game",
  "src/components/layout",
  "src/components/auth",
];

describe("participant surfaces", () => {
  it("covers the routes and chrome the redesign touched", () => {
    // Guards the guard: a renamed directory must not silently empty the scan.
    for (const surface of PARTICIPANT_SURFACES) {
      expect(sourcesIn(surface).length, surface).toBeGreaterThan(0);
    }
  });

  it("never references the standings route", () => {
    for (const surface of PARTICIPANT_SURFACES) {
      for (const file of sourcesIn(surface)) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toMatch(/\/leaderboard/);
        expect(source, file).not.toMatch(/LiveLeaderboard/);
      }
    }
  });

  it("ships no public standings feed", () => {
    expect(existsSync("src/app/api/leaderboard/route.ts")).toBe(false);
    expect(existsSync("src/components/game/live-leaderboard.tsx")).toBe(false);
  });
});

describe("legacy standings route", () => {
  const source = readFileSync("src/app/leaderboard/page.tsx", "utf8");

  it("holds no query and renders no rows", () => {
    expect(source).not.toMatch(/publicLeaderboard/);
    expect(source).not.toMatch(/computeRound1Standings/);
  });

  it("resolves the session before deciding where to send anyone", () => {
    expect(source).toMatch(/getSessionView/);
    expect(source).toMatch(/redirect\("\/admin\/leaderboard"\)/);
    expect(source).toMatch(/redirect\("\/lobby"\)/);
    expect(source).toMatch(/redirect\("\/login"\)/);
  });
});

describe("operator standings", () => {
  it("stays behind the admin guard", () => {
    const source = readFileSync("src/app/admin/leaderboard/page.tsx", "utf8");
    expect(source).toMatch(/requireAdmin/);
    expect(source).toMatch(/publicLeaderboard/);
  });

  it("is still linked from the command deck", () => {
    const source = readFileSync("src/components/admin/admin-shell.tsx", "utf8");
    expect(source).toMatch(/\/admin\/leaderboard/);
  });
});
