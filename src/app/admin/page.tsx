import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { culpritVotes, roundParticipations, rounds, teams } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { auditRoundAnswers } from "@/server/game/content-guard";
import { type UnarmedPuzzle } from "@/server/game/unarmed";
import type { RoundCode, RoundStatus } from "@/types/game";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminControls } from "@/components/admin/admin-controls";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Deck",
};

async function safeCount(
  query: Promise<Array<{ value: number }>>,
): Promise<number | null> {
  try {
    const rows = await query;
    return rows[0]?.value ?? 0;
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  const { admin } = await requireAdmin();

  let roundRows: Array<{ id: number; code: RoundCode; status: RoundStatus }> = [];
  try {
    roundRows = await db
      .select({ id: rounds.id, code: rounds.code, status: rounds.status })
      .from(rounds);
  } catch {
    roundRows = [];
  }

  const [teamCount, voteCount, qualifiedCount] = await Promise.all([
    safeCount(db.select({ value: count() }).from(teams)),
    safeCount(db.select({ value: count() }).from(culpritVotes)),
    safeCount(
      db
        .select({ value: count() })
        .from(roundParticipations)
        .where(eq(roundParticipations.qualified, true)),
    ),
  ]);

  /*
    Same audit the open-round guard runs, surfaced here so an operator sees an
    un-armed link on arrival instead of after a refused click. Degrades to
    silence if the query fails — the deck must stay readable when the database is
    the thing that is unhappy.
  */
  const round2Id = roundRows.find((row) => row.code === "ROUND_2")?.id;
  let round2Content: { unarmed: UnarmedPuzzle[]; total: number } | null = null;
  try {
    if (round2Id !== undefined) round2Content = await auditRoundAnswers(round2Id);
  } catch {
    round2Content = null;
  }

  const unarmedR2: UnarmedPuzzle[] = round2Content?.unarmed ?? [];
  const round2Total = round2Content?.total ?? 0;

  const statusOf = (code: RoundCode) => roundRows.find((r) => r.code === code)?.status;

  return (
    <AdminShell
      active="overview"
      eyebrow="Command deck // dispatch"
      title="EVENT OVERSIGHT"
      adminName={admin.username}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Panel title="Round 01">
            <StatusPill
              tone={statusOf("ROUND_1") === "ACTIVE" ? "ok" : statusOf("ROUND_1") === "PENDING" ? "warn" : "muted"}
              label={statusOf("ROUND_1") ?? "offline"}
              staticDot={statusOf("ROUND_1") !== "ACTIVE"}
            />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              {GAME_CONSTANTS.round1.durationMinutes} min · top{" "}
              {GAME_CONSTANTS.round1.qualifyingTeams}
            </p>
          </Panel>
          <Panel title="Round 02">
            <StatusPill
              tone={statusOf("ROUND_2") === "ACTIVE" ? "ok" : statusOf("ROUND_2") === "PENDING" ? "warn" : "muted"}
              label={statusOf("ROUND_2") ?? "offline"}
              staticDot={statusOf("ROUND_2") !== "ACTIVE"}
            />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              {GAME_CONSTANTS.round2.durationMinutes} min · top{" "}
              {GAME_CONSTANTS.round2.winningTeams} prevail
            </p>
            {unarmedR2.length > 0 ? (
              <p className="mt-3 border-l-2 border-alert/60 bg-alert/[0.07] px-2.5 py-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-alert">
                {unarmedR2.length} link
                {unarmedR2.length === 1 ? "" : "s"} un-armed:{" "}
                {unarmedR2
                  .map((entry) => `${entry.code} (#${entry.orderIndex}/${round2Total})`)
                  .join(", ")}
                . Opening will be refused until replaced.
              </p>
            ) : null}
          </Panel>
          <Panel title="Registered teams">
            <p className="font-display text-3xl font-semibold text-ink">{teamCount ?? "—"}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              qualified: {qualifiedCount ?? 0}
            </p>
          </Panel>
          <Panel title="Votes sealed">
            <p className="font-display text-3xl font-semibold text-ink">{voteCount ?? "—"}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              culprit verdicts on record
            </p>
          </Panel>
        </div>

        <AdminControls seeded={roundRows.length > 0} rounds={roundRows} />

        <p className="border-t border-line/60 pt-5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-dim/70 sm:tracking-[0.28em]">
          Dangerous actions require a typed confirmation and are written to the
          audit trail.
        </p>
      </div>
    </AdminShell>
  );
}
