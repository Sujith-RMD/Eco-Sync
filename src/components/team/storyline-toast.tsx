"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { subscribeToStorylineSignal } from "@/lib/storyline/signal";
import type { StorylineSummary } from "@/lib/storyline/summary";
import type { RoundCode } from "@/types/game";

const DISMISS_AFTER_MS = 9000;

const SLUG: Record<RoundCode, string> = {
  ROUND_1: "round-1",
  ROUND_2: "round-2",
};

interface StorylineToastProps {
  summary: StorylineSummary;
  /** Suppresses the toast on the page it announces — nothing to redirect from. */
  onStoryline: boolean;
}

/**
 * Announces that the case file gained content, and points at it.
 *
 * Fired only by an accepted submission (see `emitStorylineSignal` in the answer
 * form), never by a wrong one, and it re-arms rather than stacking: a team that
 * solves twice gets one visible notice, which is what "no duplicate
 * notifications for the same unlock" means from the client's side.
 *
 * On phones it docks above the tab bar, where the thumb already is; on desktop
 * it sits bottom-right, away from the chain rail. It is dismissible, expires on
 * its own, and is announced politely so a screen reader is never interrupted
 * mid-answer.
 */
export function StorylineToast({ summary, onStoryline }: StorylineToastProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (onStoryline) return;
    return subscribeToStorylineSignal("unlocked", ({ roundCode }) => {
      if (roundCode !== summary.roundCode) return;
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), DISMISS_AFTER_MS);
    });
  }, [onStoryline, summary.roundCode]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 px-3 transition-[transform,opacity] duration-300 ease-out",
        "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:px-0",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-md items-start gap-3 border border-acid/45 bg-abyss-900/95 px-4 py-3.5 shadow-[0_18px_48px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md sm:mx-0",
          !visible && "pointer-events-none",
        )}
      >
        <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-acid" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[10px] uppercase leading-snug tracking-[0.22em] text-acid">
            Storyline updated
          </p>
          <p className="text-[12px] leading-relaxed text-mist">
            New case information has been unlocked.
          </p>
          <Link
            href={`/team/${SLUG[summary.roundCode]}/storyline`}
            className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink underline decoration-acid/50 underline-offset-4 transition-colors hover:text-acid"
          >
            Open case file
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss notification"
          className="-m-1 shrink-0 p-1 text-dim transition-colors hover:text-mist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acid"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
