import "server-only";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins, puzzles, rounds, teams } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { ROUND1_PUZZLES, ROUND2_PUZZLES } from "@/server/game/catalogue";
import { normalizeAnswer } from "@/server/game/rules";

const TEAM_COUNT = 60;
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
 *   60 teams with individual access codes → one admin operator.
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

  const teamSeeds = Array.from({ length: TEAM_COUNT }, (_, index) => ({
    name: `UNIT-${String(index + 1).padStart(2, "0")}`,
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
