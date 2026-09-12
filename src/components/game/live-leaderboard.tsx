"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { LeaderboardRow, RoundCode } from "@/types/game";
import { cn } from "@/lib/utils/cn";
import { toEventClock } from "@/lib/utils/time";
import { StatusPill } from "@/components/ui/status-pill";

export interface BoardData {
  status: string | null;
  rows: LeaderboardRow[];
  serverTime?: string;
}

interface LiveLeaderboardProps {
  initial: Record<RoundCode, BoardData>;
}

/** Event-local wall clock (IST). `iso` stays a UTC instant on the wire. */
function finishTime(iso: string | null): string {
  return toEventClock(iso);
}

export function LiveLeaderboard({ initial }: LiveLeaderboardProps) {
  const [active, setActive] = useState<RoundCode>("ROUND_1");
  const [boards, setBoards] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refresh = useCallback(async (round: RoundCode) => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/leaderboard?round=${round}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as BoardData;
        setBoards((previous) => ({ ...previous, [round]: data }));
        setLastSync(new Date().toISOString());
      }
    } catch {
      // keep last-known board; next tick retries
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(active);
    const interval = setInterval(() => void refresh(active), 8000);
    return () => clearInterval(interval);
  }, [active, refresh]);

  const board = boards[active];

  return (
    <div className="relative border border-line/80 bg-abyss-900/70 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {(["ROUND_1", "ROUND_2"] as const).map((round) => (
            <button
              key={round}
              type="button"
              onClick={() => setActive(round)}
              className={cn(
                "border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors",
                active === round
                  ? "border-acid/60 bg-acid/10 text-acid"
                  : "border-line text-dim hover:text-mist",
              )}
            >
              {round === "ROUND_1" ? "Round 01" : "Round 02"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastSync ? (
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-dim sm:inline">
              synced {toEventClock(lastSync)} IST
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh(active)}
            className="inline-flex items-center gap-2 border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist transition-colors hover:border-acid/50 hover:text-acid"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            Sync
          </button>
        </div>
      </div>

      {board.rows.length === 0 ? (
        <p className="px-5 py-10 text-center font-mono text-[12px] uppercase tracking-[0.2em] text-dim">
          {board.status === null
            ? "Awaiting event initialization"
            : "No standings yet"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px] sm:min-w-[640px] sm:text-[12px]">
            <thead>
              <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.14em] text-dim sm:text-[10px] sm:tracking-[0.24em]">
                <th className="px-3 py-2.5 font-medium sm:px-5 sm:py-3">Rank</th>
                <th className="px-2 py-2.5 font-medium sm:px-3 sm:py-3">Unit</th>
                <th className="px-2 py-2.5 text-right font-medium sm:px-3 sm:py-3">Score</th>
                <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">
                  Chain
                </th>
                <th className="hidden px-3 py-3 text-right font-medium md:table-cell">
                  Finish
                </th>
                <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-b border-line/40 transition-colors hover:bg-acid/5",
                    row.rank <= 3 && "bg-acid/[0.03]",
                  )}
                >
                  <td
                    className={cn(
                      "px-3 py-2.5 tabular-nums sm:px-5 sm:py-3",
                      row.rank <= 3 ? "font-semibold text-acid" : "text-mist",
                    )}
                  >
                    #{String(row.rank).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-2.5 break-words tracking-[0.08em] text-ink sm:px-3 sm:py-3 sm:tracking-[0.14em]">
                    {row.name}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink sm:px-3 sm:py-3">
                    {row.score}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums text-mist sm:table-cell">
                    {row.solvedCount}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums text-mist md:table-cell">
                    {finishTime(row.finishedAt)}
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <div className="flex justify-end gap-2">
                      {row.qualified === true ? (
                        <StatusPill tone="ok" label="qualified" staticDot />
                      ) : row.qualified === false ? (
                        <StatusPill tone="muted" label="eliminated" staticDot />
                      ) : null}
                      {row.voted ? (
                        <StatusPill tone="muted" label="voted" staticDot />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
