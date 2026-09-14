import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { adminTeamsOverview } from "@/server/game/engine";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teams — Command Deck",
};

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { admin } = await requireAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const rows = (await adminTeamsOverview()).filter(
    (row) => !query || row.name.toLowerCase().includes(query),
  );

  return (
    <AdminShell
      active="teams"
      eyebrow="Command deck // teams"
      title="TEAM REGISTRY"
      adminName={admin.username}
    >
      <div className="space-y-4">
        <form className="flex max-w-md gap-2" role="search">
          <TextInput
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search teams…"
            autoComplete="off"
            aria-label="Search teams"
          />
          <Button type="submit" variant="ghost" size="md">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </form>

        <div className="overflow-x-auto border border-line/80 bg-abyss-900/70 backdrop-blur-md">
          <table className="w-full font-mono text-[11px] sm:min-w-[860px] sm:text-[12px]">
            <thead>
              <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.12em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Team</th>
                <th className="hidden px-3 py-3 font-medium sm:table-cell">Acct</th>
                <th className="px-2 py-2.5 text-right font-medium sm:px-3 sm:py-3">
                  R1 score
                </th>
                <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">
                  R1 chain
                </th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">
                  R1 active
                </th>
                <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">
                  Rank
                </th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Status</th>
                <th className="hidden px-3 py-3 text-right font-medium lg:table-cell">
                  R2 chain
                </th>
                <th className="px-3 py-2.5 text-right font-medium sm:px-4 sm:py-3">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-dim">
                    No teams registered.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/40 transition-colors hover:bg-acid/5">
                    <td className="px-3 py-2 break-words tracking-[0.06em] text-ink sm:px-4 sm:py-2.5 sm:tracking-[0.12em]">
                      {row.name}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <StatusPill
                        tone={row.isActive ? "ok" : "alert"}
                        label={row.isActive ? "active" : "frozen"}
                        staticDot
                      />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink sm:px-3 sm:py-2.5">
                      {row.scoreR1}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-mist sm:table-cell">
                      {row.solvedR1}/7
                    </td>
                    <td className="hidden px-3 py-2.5 text-mist lg:table-cell">
                      {row.currentR1 ?? "—"}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-mist sm:table-cell">
                      {row.finalRank !== null ? `#${row.finalRank}` : "—"}
                    </td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      {row.qualified === true ? (
                        <StatusPill tone="ok" label="qualified" staticDot />
                      ) : row.qualified === false ? (
                        <StatusPill tone="muted" label="eliminated" staticDot />
                      ) : row.voted ? (
                        <StatusPill tone="muted" label="voted" staticDot />
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-mist lg:table-cell">
                      {row.solvedR2}/{GAME_CONSTANTS.round2.puzzleCount}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-2.5">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/teams/${row.id}`}
                          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-acid transition-colors hover:text-ink"
                        >
                          Detail
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
