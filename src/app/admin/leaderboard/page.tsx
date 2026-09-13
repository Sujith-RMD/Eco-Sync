import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { GAME_CONSTANTS } from "@/server/game/constants";
import {
  computeRound1Standings,
  publicLeaderboard,
} from "@/server/game/engine";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { toEventClock } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Final Rankings — Command Deck",
};

/** Event-local wall clock (IST) for finish times; instants stay UTC in the DB. */
function fmt(iso: Date | string | null): string {
  return toEventClock(iso);
}

export default async function AdminLeaderboardPage() {
  const { admin } = await requireAdmin();
  const [r1Standings, r2Board] = await Promise.all([
    computeRound1Standings(),
    publicLeaderboard("ROUND_2"),
  ]);

  return (
    <AdminShell
      active="leaderboard"
      eyebrow="Command deck // standings"
      title="FINAL RANKINGS"
      adminName={admin.username}
    >
      <div className="space-y-4">
        <Panel title="Round 01 — scores & tie-break order">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] sm:min-w-[760px] sm:text-[12px]">
              <thead>
                <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.1em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                  <th className="px-2 py-2 font-medium sm:px-3">Rank</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Unit</th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3 sm:text-right">
                    Score
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    Chain
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                    Finish (IST)
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">
                    Wrong −
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">
                    Hints
                  </th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">Cut</th>
                </tr>
              </thead>
              <tbody>
                {r1Standings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-dim">
                      No standings — event not seeded.
                    </td>
                  </tr>
                ) : (
                  r1Standings.map((row) => (
                    <tr
                      key={row.teamId}
                      className={`border-b border-line/40 ${row.rank <= 15 ? "bg-acid/[0.03]" : ""}`}
                    >
                      <td className={`px-2 py-2 tabular-nums sm:px-3 ${row.rank <= 15 ? "text-acid" : "text-mist"}`}>
                        #{row.rank}
                      </td>
                      <td className="px-2 py-2 break-words text-ink sm:px-3">
                        {row.teamName}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink sm:px-3">
                        {row.score}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist sm:table-cell">
                        {row.solvedCount}/7
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist md:table-cell">
                        {fmt(row.finishedAt)}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist lg:table-cell">
                        {row.totalWrongPenalty}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist lg:table-cell">
                        {row.totalHints}
                      </td>
                      <td className={`px-2 py-2 text-right sm:px-3 ${row.rank <= 15 ? "text-acid" : "text-dim"}`}>
                        {row.rank <= 15 ? "QUALIFIES" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Round 02 — winner order (finish time first)">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] sm:min-w-[640px] sm:text-[12px]">
              <thead>
                <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.1em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                  <th className="px-2 py-2 font-medium sm:px-3">Rank</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Unit</th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Score
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    Chain
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                    Finish (IST)
                  </th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Voted
                  </th>
                </tr>
              </thead>
              <tbody>
                {r2Board.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-dim">
                      No Round 02 roster yet — run QUALIFY TOP 15.
                    </td>
                  </tr>
                ) : (
                  r2Board.rows.map((row) => (
                    <tr
                      key={row.teamId}
                      className={`border-b border-line/40 ${row.rank <= 3 ? "bg-acid/[0.03]" : ""}`}
                    >
                      <td className={`px-2 py-2 tabular-nums sm:px-3 ${row.rank <= 3 ? "text-acid" : "text-mist"}`}>
                        #{row.rank}
                      </td>
                      <td className="px-2 py-2 break-words text-ink sm:px-3">
                        {row.name}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink sm:px-3">
                        {row.score}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist sm:table-cell">
                        {row.solvedCount}/{GAME_CONSTANTS.round2.puzzleCount}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist md:table-cell">
                        {fmt(row.finishedAt)}
                      </td>
                      <td className={`px-2 py-2 text-right sm:px-3 ${row.voted ? "text-mist" : "text-dim"}`}>
                        {row.voted ? "SEALED" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
