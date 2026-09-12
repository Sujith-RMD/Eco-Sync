import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { publicLeaderboard } from "@/server/game/engine";
import { getSessionView } from "@/lib/auth/session";
import type { SessionView } from "@/types/auth";
import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { LiveLeaderboard } from "@/components/game/live-leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Standings",
};

/**
 * Where "back" leads, depending on who is looking at the board. The public
 * leaderboard is entered from the unit lobby and from the command deck, and
 * until now offered no exit control at all — the only way out was the brand
 * logo, which dropped a signed-in team onto the public landing page with no
 * route back to their console.
 */
function backTarget(
  subject: SessionView["subject"] | null,
): { href: string; label: string } {
  if (subject === "TEAM") return { href: "/lobby", label: "Back to lobby" };
  if (subject === "ADMIN")
    return { href: "/admin", label: "Back to deck" };
  return { href: "/", label: "Home" };
}

export default async function LeaderboardPage() {
  const [r1, r2, session] = await Promise.all([
    publicLeaderboard("ROUND_1"),
    publicLeaderboard("ROUND_2"),
    getSessionView(),
  ]);

  const back = backTarget(session?.subject ?? null);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Topbar>
        <StatusPill tone="ok" label="live feed" />
        <Link href={back.href} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      </Topbar>
      <main className="relative z-10 mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Eyebrow>Official standings</Eyebrow>
        <div className="mt-4 mb-8 flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            LIVE LEADERBOARD
          </h1>
          <ClipboardList className="h-6 w-6 text-dim" />
        </div>
        <LiveLeaderboard initial={{ ROUND_1: r1, ROUND_2: r2 }} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-dim/70">
            Server-authoritative. Scores derive from the immutable event ledger.
          </p>
          {/* Mobile escape hatch: the board is long, and the topbar scrolls away. */}
          <Link href={back.href} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {back.label}
          </Link>
        </div>
      </main>
    </div>
  );
}
