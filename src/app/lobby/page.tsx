import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roundParticipations, rounds, teams } from "@/db/schema";
import { requireTeam } from "@/lib/auth/guards";
import { GAME_CONSTANTS } from "@/server/game/constants";
import type { RoundStatus } from "@/types/game";
import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { AutoRefresh } from "@/components/game/timer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Lobby",
};

interface LobbyBoard {
  rounds: Partial<Record<"ROUND_1" | "ROUND_2", RoundStatus>>;
  hasRound2Access: boolean;
  initialized: boolean;
}

async function loadBoard(teamId: number): Promise<LobbyBoard> {
  try {
    const roundRows = await db
      .select({ id: rounds.id, code: rounds.code, status: rounds.status })
      .from(rounds);
    let hasRound2Access = false;
    const r2 = roundRows.find((r) => r.code === "ROUND_2");
    if (r2) {
      const participation = await db.query.roundParticipations.findFirst({
        where: and(
          eq(roundParticipations.teamId, teamId),
          eq(roundParticipations.roundId, r2.id),
        ),
      });
      hasRound2Access = Boolean(participation);
    }
    return {
      rounds: Object.fromEntries(roundRows.map((r) => [r.code, r.status])),
      hasRound2Access,
      initialized: roundRows.length > 0,
    };
  } catch {
    return { rounds: {}, hasRound2Access: false, initialized: false };
  }
}

function statusTone(status: RoundStatus | undefined) {
  if (status === "ACTIVE") return { tone: "ok" as const, label: "live now" };
  if (status === "ENDED") return { tone: "muted" as const, label: "ended" };
  if (status === "PENDING") return { tone: "warn" as const, label: "standby" };
  return { tone: "muted" as const, label: "offline" };
}

export default async function LobbyPage() {
  const { team } = await requireTeam();
  const board = await loadBoard(team.id);

  const r1 = statusTone(board.rounds.ROUND_1);
  const r2 = statusTone(board.rounds.ROUND_2);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      {/*
        The lobby is where every team waits for the operator to open a round, so
        it polls for that status flip. Cadence is deliberately slower than the
        round console's 8s: this is the one screen all sixty-one handsets sit on at
        the same time, and at 8s that alone is 7.5 server renders per second
        against a measured single-process ceiling near 10. Twelve seconds keeps
        about half the capacity free and still surfaces a round start within one
        glance. AutoRefresh is visibility-gated, so a locked phone polls nothing.
      */}
      <AutoRefresh intervalMs={12_000} />
      <Topbar>
        <StatusPill tone="ok" label={`team // ${team.name}`} />
        <LogoutButton />
      </Topbar>

      <main className="relative z-10 mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <Eyebrow>Link established</Eyebrow>
        <h1 className="mt-4 break-words font-display text-3xl font-bold tracking-tight text-ink sm:mt-5 sm:text-5xl">
          {team.name}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
          Official time, score and progression are kept on the server, and this
          board updates itself when a round opens — refresh freely, state
          survives. Once you are inside a round, three doors hold everything you
          need: the case file, the answer link, and the suspects.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Panel title="Round 01 // The Breach" aside={<StatusPill tone={r1.tone} label={r1.label} />}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              {GAME_CONSTANTS.round1.durationMinutes}:00 ·{" "}
              {GAME_CONSTANTS.round1.puzzleCount} links · top{" "}
              {GAME_CONSTANTS.round1.qualifyingTeams} advance
            </p>
            <div className="mt-5">
              {board.initialized ? (
                <Link href="/team/round-1" className={buttonClasses({ className: "w-full" })}>
                  Enter round 01
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <p className="font-mono text-[12px] text-dim">Awaiting event seed…</p>
              )}
            </div>
          </Panel>

          <Panel title="Round 02 // Culprit Trail" aside={<StatusPill tone={r2.tone} label={r2.label} />}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              {GAME_CONSTANTS.round2.durationMinutes}:00 ·{" "}
              {GAME_CONSTANTS.round2.puzzleCount} links · final code · culprit
              vote
            </p>
            <div className="mt-5">
              {board.hasRound2Access ? (
                <Link href="/team/round-2" className={buttonClasses({ className: "w-full" })}>
                  Enter round 02
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
                  <Lock className="h-4 w-4" />
                  Sealed — qualify in Round 01
                </p>
              )}
            </div>
          </Panel>
        </div>

        <p className="mt-8 border-t border-line/60 pt-6 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-dim/70 sm:mt-10 sm:tracking-[0.3em]">
          Do not share your channel. Official time is kept on the server.
        </p>
      </main>
    </div>
  );
}
