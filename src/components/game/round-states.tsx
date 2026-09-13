import Link from "next/link";
import { Binoculars, Radio } from "lucide-react";
import type { TeamSnapshotResult } from "@/types/game";
import { Panel } from "@/components/ui/panel";
import { buttonClasses } from "@/components/ui/button";
import { AutoRefresh } from "@/components/game/timer";
import { RoundConsole } from "@/components/game/round-console";

/**
 * View switch for every round-visibility state.
 *
 * Page chrome (identity, the three tabs, the unlock notice) lives in
 * `TeamShell`; this component only decides which body the Answers tab shows.
 */

function StandbyView({ minutesNote }: { minutesNote: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <AutoRefresh intervalMs={5000} />
      <Panel
        title="Awaiting go-signal"
        aside={<Radio className="h-4 w-4 text-caution animate-pulse" />}
      >
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
          <Panel title="Access denied — Round 02">
            <div className="space-y-4">
              <p className="font-mono text-[12px] leading-relaxed text-mist">
                {result.reason === "AWAITING_QUALIFICATION"
                  ? "Qualification has not been finalized. Only the top 15 units of Round 01 breach this perimeter — stand by for the official cut."
                  : "Your unit did not qualify for Round 02. The custody chain thanks you for a clean investigation."}
              </p>
              <Link
                href="/lobby"
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                <Binoculars className="h-3.5 w-3.5" />
                Back to lobby
              </Link>
            </div>
          </Panel>
        </div>
      );

    case "ready":
      return <RoundConsole snapshot={result.snapshot} />;
  }
}
