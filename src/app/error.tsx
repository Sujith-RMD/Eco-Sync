"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Undo2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button, buttonClasses } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

/**
 * Route-level failure boundary for every page under the root layout.
 *
 * Every participant route is `force-dynamic` and makes ~10 database round-trips
 * per render, so one transient pooler failure used to hand a team Next's default
 * error screen: no branding, no explanation, no way back. With 61 phones polling
 * every 8 seconds, a single bad minute read as a dead event.
 *
 * Two deliberate choices in the copy:
 *
 * - It blames the *server*, not the team. Almost every one of these will be a
 *   blip, and a team that thinks it broke something stops playing.
 * - It does not print the error. In production Next redacts the message anyway,
 *   and a raw one could carry SQL. The `digest` is surfaced instead, because it
 *   is the one token that ties this screen to a line in the server logs.
 *
 * `reset()` re-renders the segment, which re-runs the query — so retry is the
 * correct primary action for the failure this exists to absorb.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Full stack to the browser console, for the operator's laptop.
    console.error("[eco-sync] route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <Panel
        title="Signal interrupted"
        aside={<StatusPill tone="alert" label="link unstable" staticDot />}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alert" />
            <div className="min-w-0 space-y-2">
              <p className="font-mono text-[12px] leading-relaxed text-mist">
                This screen could not reach the custody chain. Nothing you did
                caused it, and nothing was lost — every submission and point is
                recorded on the server, not on this phone.
              </p>
              <p className="font-mono text-[11px] leading-relaxed text-dim">
                Tap retry. If it stays down, keep this screen open and a
                coordinator will read the reference below off your device.
              </p>
            </div>
          </div>

          {error.digest ? (
            <p className="border border-line/60 bg-abyss-950/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              Reference <span className="text-mist">{error.digest}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
            <Button type="button" onClick={reset}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            {/*
              `/` is prerendered, so it is the one destination that still works
              when the database is unreachable. It is also role-neutral, which
              matters because this boundary covers the command deck too.
            */}
            <Link href="/" className={buttonClasses({ variant: "ghost" })}>
              <Undo2 className="h-4 w-4" />
              Start screen
            </Link>
          </div>
        </div>
      </Panel>
    </main>
  );
}
