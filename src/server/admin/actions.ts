"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  admins,
  authThrottle,
  culpritVotes,
  hintUsages,
  puzzleAttempts,
  puzzles,
  roundParticipations,
  rounds,
  scoreEvents,
  sessions,
  teamPuzzleProgress,
  teams,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { logAudit } from "@/server/audit/log";
import { seedEvent } from "@/server/game/seed";
import {
  applyQualification,
  endRound,
  startRound,
} from "@/server/game/engine";
import type {
  AdminActionState,
  SeedActionState,
} from "@/types/admin";

const CONFIRM_PHRASE = "CONFIRM";
const RESTART_PHRASE = "RESTART";
const PURGE_PHRASE = "PURGE";

function confirmationOk(formData: FormData, phrase: string): boolean {
  return String(formData.get("confirm") ?? "").trim() === phrase;
}

const seedSchema = z.object({
  adminUsername: z
    .string()
    .trim()
    .min(3, "Operator ID must be at least 3 characters.")
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Operator ID: letters, digits, . _ - only."),
  adminPassword: z
    .string()
    .min(10, "Passphrase must be at least 10 characters.")
    .max(128),
});

/**
 * One-shot event bootstrap. Allowed WITHOUT admin auth only while zero admin
 * operators exist (first-run). Afterwards it is a guarded admin operation.
 * Throws are converted into safe UI states.
 */
export async function seedEventAction(
  _previous: SeedActionState,
  formData: FormData,
): Promise<SeedActionState> {
  const ip = await getClientIp();

  let actorId: number | null = null;
  try {
    const [{ value: adminCount }] = await db
      .select({ value: count() })
      .from(admins);
    if (adminCount > 0) {
      const context = await requireAdmin();
      actorId = context.admin.id;
    }
  } catch {
    return { status: "error", message: "System is not initialized. Apply the database schema first." };
  }

  // Keyed to whoever is authenticated (the address is useless here: the whole
  // venue shares one) and generous, because the failure it guards against —
  // hammering bootstrap — is already gated by admin auth and the phrase.
  const gate = consumeRateLimit(
    `admin:seed:${actorId ?? ip ?? "first-run"}`,
    8,
    10 * 60_000,
  );
  if (!gate.allowed) {
    return { status: "error", message: `Too many attempts. Retry in ${gate.retryAfterSeconds}s.` };
  }

  if (!confirmationOk(formData, CONFIRM_PHRASE)) {
    return { status: "error", message: `Type ${CONFIRM_PHRASE} to arm this action.` };
  }

  const parsed = seedSchema.safeParse({
    adminUsername: formData.get("adminUsername"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid operator credentials format.",
    };
  }

  try {
    const result = await seedEvent(parsed.data);
    await logAudit({
      actorType: actorId === null ? "SYSTEM" : "ADMIN",
      actorId,
      action: "event.seed",
      entity: "round",
      meta: {
        teams: result.teamCount,
        puzzles: result.puzzleCounts,
        adminUsername: parsed.data.adminUsername,
      },
      ip,
    });
    revalidatePath("/admin");
    return {
      status: "ok",
      message: `Event seeded: ${result.teamCount} units, ${result.puzzleCounts.round1} + ${result.puzzleCounts.round2} puzzles, 1 operator. Distribute credentials below.`,
      result,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "EVENT_ALREADY_SEEDED") {
      return { status: "error", message: "Event already seeded. Use RESTART on the command deck to replay with the same access codes." };
    }
    console.error("[admin] seed failed", error);
    return { status: "error", message: "Seeding failed. Check server logs." };
  }
}

const roundControlSchema = z.object({
  roundCode: z.enum(["ROUND_1", "ROUND_2"]),
});

export async function startRoundAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { admin } = await requireAdmin();
  if (!confirmationOk(formData, CONFIRM_PHRASE)) {
    return { status: "error", message: `Type ${CONFIRM_PHRASE} to arm this action.` };
  }
  const parsed = roundControlSchema.safeParse({ roundCode: formData.get("roundCode") });
  if (!parsed.success) return { status: "error", message: "Unknown round reference." };

  const result = await startRound(admin.id, parsed.data.roundCode);
  revalidatePath("/admin");
  revalidatePath("/lobby");
  return { status: result.ok ? "ok" : "error", message: result.message };
}

export async function endRoundAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { admin } = await requireAdmin();
  if (!confirmationOk(formData, CONFIRM_PHRASE)) {
    return { status: "error", message: `Type ${CONFIRM_PHRASE} to arm this action.` };
  }
  const parsed = roundControlSchema.safeParse({ roundCode: formData.get("roundCode") });
  if (!parsed.success) return { status: "error", message: "Unknown round reference." };

  const result = await endRound(admin.id, parsed.data.roundCode);
  revalidatePath("/admin");
  return { status: result.ok ? "ok" : "error", message: result.message };
}

export async function qualifyTop15Action(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { admin } = await requireAdmin();
  if (!confirmationOk(formData, CONFIRM_PHRASE)) {
    return { status: "error", message: `Type ${CONFIRM_PHRASE} to arm this action.` };
  }
  const result = await applyQualification(admin.id);
  revalidatePath("/admin");
  revalidatePath("/admin/leaderboard");
  return { status: result.ok ? "ok" : "error", message: result.message };
}

/**
 * RESTART — wipe and replay.
 *
 * Deletes every scrap of play data (ledger, progression, attempts, hints,
 * verdicts, qualifications) and puts both rounds back to PENDING, while
 * KEEPING the units and the access codes already handed out, the puzzle chain,
 * the operators and the audit trail. The same credential slips work again: no
 * re-seeding, no re-printing.
 *
 * Despite the immutable-ledger design this is safe, because progression rows
 * are created lazily by `getTeamRoundSnapshot` (`onConflictDoNothing`) instead
 * of being seeded — so each unit's chain rebuilds itself as soon as a round is
 * started again. Team sessions are dropped so a leftover open tab cannot carry
 * a previous run's identity into the replay.
 */
export async function restartEventAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { admin } = await requireAdmin();
  const ip = await getClientIp();

  if (!confirmationOk(formData, RESTART_PHRASE)) {
    return {
      status: "error",
      message: `Type ${RESTART_PHRASE} to authorize the restart.`,
    };
  }

  // Interlock: never wipe the board underneath a clock that is still running.
  const liveRounds = await db
    .select({ code: rounds.code })
    .from(rounds)
    .where(eq(rounds.status, "ACTIVE"));
  if (liveRounds.length > 0) {
    const label = liveRounds[0].code === "ROUND_1" ? "Round 01" : "Round 02";
    return {
      status: "error",
      message: `${label} is still live. End it first, then restart.`,
    };
  }

  // Double-fire guard, and deliberately the LAST check: a mistyped phrase or a
  // round that is still live is a safe refusal, not abuse, so neither may burn
  // this budget. Keyed to the operator rather than the address — every phone
  // and laptop in the venue leaves through one egress IP.
  const gate = consumeRateLimit(`admin:restart:${admin.id}`, 3, 10 * 60_000);
  if (!gate.allowed) {
    return {
      status: "error",
      message: `Too many restarts. Retry in ${gate.retryAfterSeconds}s.`,
    };
  }

  const [{ n: unitCount }] = await db.select({ n: count() }).from(teams);

  const wiped = await db.transaction(async (tx) => {
    const votes = await tx.select({ n: count() }).from(culpritVotes);
    const hints = await tx.select({ n: count() }).from(hintUsages);
    const attempts = await tx.select({ n: count() }).from(puzzleAttempts);
    const progress = await tx.select({ n: count() }).from(teamPuzzleProgress);
    const ledger = await tx.select({ n: count() }).from(scoreEvents);
    const participations = await tx
      .select({ n: count() })
      .from(roundParticipations);

    // FK-safe order: leaves before the rows they point at.
    await tx.delete(culpritVotes);
    await tx.delete(hintUsages);
    await tx.delete(puzzleAttempts);
    await tx.delete(teamPuzzleProgress);
    await tx.delete(scoreEvents);
    await tx.delete(roundParticipations);
    await tx.delete(sessions).where(eq(sessions.subject, "TEAM"));
    // A reset also releases any unit paused by the sign-in throttle, so an
    // operator can always unstick the room from the same button.
    const throttled = await tx
      .delete(authThrottle)
      .returning({ key: authThrottle.key });
    await tx
      .update(rounds)
      .set({ status: "PENDING", startedAt: null, endsAt: null, endedAt: null });

    return {
      votes: votes[0]?.n ?? 0,
      hints: hints[0]?.n ?? 0,
      attempts: attempts[0]?.n ?? 0,
      progress: progress[0]?.n ?? 0,
      ledger: ledger[0]?.n ?? 0,
      participations: participations[0]?.n ?? 0,
      signInsReleased: throttled.length,
    };
  });

  await logAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "event.restart",
    entity: "round",
    meta: {
      wiped,
      kept: { units: unitCount, accessCodes: true, rounds: true, puzzles: true },
      roundsResetTo: "PENDING",
    },
    ip,
  });

  for (const path of [
    "/admin",
    "/admin/teams",
    "/admin/leaderboard",
    "/admin/votes",
    "/admin/audit",
    "/lobby",
  ]) {
    revalidatePath(path);
  }

  return {
    status: "ok",
    message:
      `Event reset for replay. ${unitCount} units and their access codes kept. ` +
      `Cleared ${wiped.ledger} ledger events, ${wiped.progress} progression rows, ` +
      `${wiped.attempts} attempts, ${wiped.hints} hint uses, ${wiped.votes} verdicts. ` +
      `Both rounds are PENDING and every unit has signed out — start Round 01 when ready.`,
  };
}

/**
 * Full wipe: also deletes rounds, puzzles, teams and their access codes, for
 * operators who need a brand-new event with fresh credentials. Kept behind an
 * explicit disclosure in the danger zone — RESTART is the everyday path.
 * Admin operators and the audit trail always survive.
 */
export async function purgeEventAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { admin } = await requireAdmin();
  if (!confirmationOk(formData, PURGE_PHRASE)) {
    return { status: "error", message: `Type ${PURGE_PHRASE} to authorize the purge.` };
  }

  await db.transaction(async (tx) => {
    await tx.delete(culpritVotes);
    await tx.delete(hintUsages);
    await tx.delete(puzzleAttempts);
    await tx.delete(teamPuzzleProgress);
    await tx.delete(scoreEvents);
    await tx.delete(roundParticipations);
    await tx.delete(puzzles);
    await tx.delete(rounds);
    await tx.delete(sessions).where(eq(sessions.subject, "TEAM"));
    // Credentials are going away with the teams, so their throttles must too.
    await tx.delete(authThrottle);
    await tx.delete(teams);
  });

  await logAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "event.purge",
    entity: "round",
    meta: { preserved: ["admins", "audit_logs"] },
  });
  revalidatePath("/admin");
  return { status: "ok", message: "Event data purged. Operators and audit trail preserved." };
}
