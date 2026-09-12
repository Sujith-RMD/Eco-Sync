import Link from "next/link";
import type { ReactNode } from "react";
import { Binoculars, ClipboardList, Lock, Radio } from "lucide-react";
import type { TeamSnapshotResult } from "@/types/game";
import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { AutoRefresh } from "@/components/game/timer";
import { RoundConsole } from "@/components/game/round-console";

/** Full-page chrome for team round views. */
export function RoundShell({
  eyebrow,
  title,
  teamName,
  children,
}: {
  eyebrow: string;
  title: string;
  teamName: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Topbar>
        <StatusPill tone="ok" label={`unit // ${teamName}`} />
        <Link href="/lobby" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <Binoculars className="h-3.5 w-3.5" />
          Lobby
        </Link>
        <LogoutButton />
      </Topbar>
      <main className="relative z-10 mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 mb-6 break-words font-display text-2xl font-bold tracking-tight text-ink sm:mb-8 sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

function StandbyView({ minutesNote }: { minutesNote: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <AutoRefresh intervalMs={5000} />
      <Panel title="Awaiting go-signal" aside={<Radio className="h-4 w-4 text-caution animate-pulse" />}>
        <div className="space-y-3">
          <p className="font-mono text-[12px] leading-relaxed text-mist">
            This round has not started. Puzzles unseal the moment command starts
            the official clock — keep this channel open.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            {minutesNote}. Refreshing automatically.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/** Switch view for every possible round-visibility state. */
export function RoundStateView({ result }: { result: TeamSnapshotResult }) {
  switch (result.kind) {
    case "uninitialized":
      return (
        <div className="mx-auto max-w-lg">
          <Panel title="Event not initialized">
            <p className="font-mono text-[12px] leading-relaxed text-mist">
              Command has not seeded this operation yet. Check back shortly or
              contact a coordinator.
            </p>
          </Panel>
        </div>
      );

    case "pending":
      return (
        <StandbyView
          minutesNote={`Round window: ${result.round.durationMinutes} minutes`}
        />
      );

    case "gated":
      return (
        <div className="mx-auto max-w-lg">
          <AutoRefresh intervalMs={10000} />
          <Panel
            title="Access denied — Round 02"
            aside={<Lock className="h-4 w-4 text-dim" />}
          >
            <div className="space-y-4">
              <p className="font-mono text-[12px] leading-relaxed text-mist">
                {result.reason === "AWAITING_QUALIFICATION"
                  ? "Qualification has not been finalized. Only the top 15 units of Round 01 breach this perimeter — stand by for the official standings."
                  : "Your unit did not qualify for Round 02. The custody chain thanks you for a clean investigation."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/lobby" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                  Back to lobby
                </Link>
                <Link
                  href="/leaderboard"
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Standings
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      );

    case "ready":
      return <RoundConsole snapshot={result.snapshot} />;
  }
}
