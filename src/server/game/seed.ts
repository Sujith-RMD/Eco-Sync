import "server-only";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins, puzzles, rounds, teams } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { ROUND1_PUZZLES, ROUND2_PUZZLES } from "@/server/game/catalogue";
import { normalizeAnswer } from "@/server/game/rules";

/**
 * Check-in roster, in sheet order. `name` is the login identifier issued at the
 * desk — the real TEAM#XXXX designation, not a placeholder. The order pairs each
 * team with the access code printed beside it, so it must not be reshuffled.
 *
 * Exported because it is the only copy of the mapping: `scripts/apply-roster.ts`
 * reads it to migrate a database still holding the old `UNIT-NN` logins, and
 * `db/roster-rename.sql` is generated from that. A second hand-written copy of
 * sixty-one designations is a second place to get one of them wrong.
 */
export const TEAM_ROSTER = [
  "TEAM#8210", "TEAM#9303", "TEAM#5376", "TEAM#3481", // AB5-101
  "TEAM#8938", "TEAM#3768", "TEAM#1259", "TEAM#1996", // AB5-102
  "TEAM#7505", "TEAM#8824", "TEAM#3555", "TEAM#8197", // AB5-107
  "TEAM#6257", "TEAM#2524", "TEAM#1360", "TEAM#4802", // AB5-109
  "TEAM#5594", "TEAM#1379", "TEAM#4217", "TEAM#6940", // AB5-201
  "TEAM#4948", "TEAM#8248", "TEAM#7302", "TEAM#4877", // AB5-202
  "TEAM#9776", "TEAM#1924", "TEAM#2292", "TEAM#7580", // AB5-203
  "TEAM#9023", "TEAM#4320", "TEAM#2120", "TEAM#6667", // AB5-204
  "TEAM#8254", "TEAM#1367", "TEAM#6141", "TEAM#1263", // AB5-205
  "TEAM#8829", "TEAM#8041", "TEAM#2566", "TEAM#3714", // AB5-206
  "TEAM#8275", "TEAM#7063", "TEAM#1571", "TEAM#9174", // AB5-207
  "TEAM#5698", "TEAM#9561", "TEAM#7129", "TEAM#5050", // AB5-208
  "TEAM#3986", "TEAM#4584", "TEAM#4500", "TEAM#2927", // AB5-209
  "TEAM#1899", "TEAM#3187", "TEAM#9180", "TEAM#3038", // AB5-210
  "TEAM#9298", "TEAM#5349", "TEAM#6764", "TEAM#9312", // AB5-211
  "TEAM#5312",                                        // AB5-212
];

/** Alphabet avoids ambiguous glyphs (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateAccessCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i += 1) {
    raw += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export interface SeedOutcome {
  teams: Array<{ name: string; accessCode: string }>;
  adminUsername: string;
  teamCount: number;
  puzzleCounts: { round1: number; round2: number };
}

/**
 * One-shot, idempotent event bootstrap:
 *   rounds (R1 40min / R2 75min) → full supplied puzzle catalogue →
 *   every rostered team with an individual access code → one admin operator.
 * Throws EVENT_ALREADY_SEEDED if rounds already exist.
 */
export async function seedEvent(input: {
  adminUsername: string;
  adminPassword: string;
}): Promise<SeedOutcome> {
  const existing = await db.query.rounds.findFirst({
    where: eq(rounds.code, "ROUND_1"),
  });
  if (existing) {
    throw new Error("EVENT_ALREADY_SEEDED");
  }

  const teamSeeds = TEAM_ROSTER.map((name) => ({
    name,
    accessCode: generateAccessCode(),
  }));

  // Hashing is CPU-bound (scrypt); run outside the transaction.
  const [teamHashes, adminHash] = await Promise.all([
    Promise.all(teamSeeds.map((team) => hashPassword(team.accessCode))),
    hashPassword(input.adminPassword),
  ]);

  await db.transaction(async (tx) => {
    const [r1] = await tx
      .insert(rounds)
      .values({
        code: "ROUND_1",
        name: "Round 01 — The Breach",
        durationMinutes: GAME_CONSTANTS.round1.durationMinutes,
      })
      .returning({ id: rounds.id });
    const [r2] = await tx
      .insert(rounds)
      .values({
        code: "ROUND_2",
        name: "Round 02 — Culprit Trail",
        durationMinutes: GAME_CONSTANTS.round2.durationMinutes,
      })
      .returning({ id: rounds.id });

    if (!r1 || !r2) throw new Error("ROUND_SEED_FAILED");

    await tx.insert(puzzles).values(
      ROUND1_PUZZLES.map((p) => ({
        roundId: r1.id,
        code: p.code,
        orderIndex: p.orderIndex,
        kind: p.kind,
        title: p.title,
        briefing: p.briefing,
        expectedAnswerNormalized: normalizeAnswer(p.answer),
        hints: p.hints,
        points: p.points,
      })),
    );
    await tx.insert(puzzles).values(
      ROUND2_PUZZLES.map((p) => ({
        roundId: r2.id,
        code: p.code,
        orderIndex: p.orderIndex,
        kind: p.kind,
        title: p.title,
        briefing: p.briefing,
        expectedAnswerNormalized: normalizeAnswer(p.answer),
        hints: p.hints,
        points: p.points,
      })),
    );

    await tx.insert(teams).values(
      teamSeeds.map((team, index) => ({
        name: team.name,
        accessCodeHash: teamHashes[index]!,
      })),
    );

    await tx.insert(admins).values({
      username: input.adminUsername,
      passwordHash: adminHash,
      displayName: "Command Operator",
    });
  });

  return {
    teams: teamSeeds,
    adminUsername: input.adminUsername,
    teamCount: teamSeeds.length,
    puzzleCounts: { round1: ROUND1_PUZZLES.length, round2: ROUND2_PUZZLES.length },
  };
}
