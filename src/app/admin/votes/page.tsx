import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { adminVotesOverview } from "@/server/game/engine";
import { cn } from "@/lib/utils/cn";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { toEventClock } from "@/lib/utils/time";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Culprit Votes — Command Deck",
};

export default async function AdminVotesPage() {
  const { admin } = await requireAdmin();
  const overview = await adminVotesOverview();
  const maxCount = Math.max(1, ...overview.distribution.map((d) => d.count));

  return (
    <AdminShell
      active="votes"
      eyebrow="Command deck // verdicts"
      title="CULPRIT VOTES"
      adminName={admin.username}
    >
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel title="Distribution" aside={<StatusPill tone="warn" label={`${overview.total} sealed`} staticDot />}>
          <div className="space-y-3">
            {overview.distribution.map((entry) => {
              const isCorrect = entry.suspect.code === overview.correctSuspectCode;
              return (
                <div key={entry.suspect.code}>
                  <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                    <span className={cn("uppercase tracking-[0.14em]", isCorrect ? "text-acid" : "text-mist")}>
                      {entry.suspect.name}
                    </span>
                    <span className="tabular-nums text-dim">{entry.count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-abyss-950">
                    <div
                      className={cn("h-full transition-all", isCorrect ? "bg-acid" : "bg-line")}
                      style={{ width: `${(entry.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="flex items-center gap-2 border-t border-line/60 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              <ShieldCheck className="h-3.5 w-3.5 text-acid" />
              Highlighted suspect = supplied correct culprit
            </p>
          </div>
        </Panel>

        <Panel title="Vote ledger">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] sm:min-w-[560px] sm:text-[12px]">
              <thead>
                <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.12em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-2 py-2 font-medium sm:px-3 sm:py-2">
                    Verdict
                  </th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">
                    Assessment
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Sealed at</th>
                </tr>
              </thead>
              <tbody>
                {overview.votes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-dim">
                      No votes sealed yet.
                    </td>
                  </tr>
                ) : (
                  overview.votes.map((vote) => (
                    <tr key={vote.teamId} className="border-b border-line/40">
                      <td className="px-3 py-2.5 break-words text-ink">
                        {vote.teamName}
                      </td>
                      <td className="px-2 py-2.5 break-words text-mist sm:px-3">
                        {vote.suspectName}
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <StatusPill
                          tone={vote.isCorrect ? "ok" : "alert"}
                          label={vote.isCorrect ? "correct" : "wrong"}
                          staticDot
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-dim">
                        {toEventClock(vote.createdAt)}
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
