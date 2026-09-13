"use client";

import Link from "next/link";
import { BookMarked, Terminal, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useStorylineRead } from "@/lib/storyline/use-storyline-read";
import type { StorylineSummary } from "@/lib/storyline/summary";
import type { RoundCode } from "@/types/game";

export type ParticipantTab = "storyline" | "answers" | "suspects";

interface ParticipantNavProps {
  /** Which round's case file, briefings and roster these tabs belong to. */
  round: RoundCode;
  active: ParticipantTab;
  summary: StorylineSummary;
  /** Chain position for the "where am I" line. Null before the round opens. */
  progress: { solved: number; total: number; currentCode: string | null } | null;
}

const TABS: {
  key: ParticipantTab;
  label: string;
  href: (round: string) => string;
  icon: typeof BookMarked;
  hint: string;
}[] = [
  {
    key: "storyline",
    label: "Storyline",
    href: (round) => `/team/${round}/storyline`,
    icon: BookMarked,
    hint: "What happened, and what you have uncovered",
  },
  {
    key: "answers",
    label: "Answers",
    href: (round) => `/team/${round}`,
    icon: Terminal,
    hint: "Break the current link",
  },
  {
    key: "suspects",
    label: "Suspects",
    href: (round) => `/team/${round}/suspects`,
    icon: UserSearch,
    hint: "The people inside the perimeter",
  },
];

const SLUG: Record<RoundCode, string> = {
  ROUND_1: "round-1",
  ROUND_2: "round-2",
};

function UnreadDot({ count, hydrated }: { count: number; hydrated: boolean }) {
  if (!hydrated || count <= 0) {
    // Reserved space, so the badge appearing never shifts the label.
    return <span aria-hidden className="h-1.5 w-1.5" />;
  }
  return (
    <span
      aria-hidden
      className="relative flex h-1.5 w-1.5 shrink-0 animate-badge-pop items-center justify-center"
    >
      <span className="absolute inset-0 -m-1 rounded-full bg-caution/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-caution" />
    </span>
  );
}

/**
 * Participant navigation: exactly three destinations, and no standings view
 * anywhere near it. Rendered as a thumb-height bar fixed to the bottom edge on
 * phones (the answer field and the chain both live above it, and nothing needs
 * a reach to the top of the screen) and as a segmented strip inline on tablets
 * and desktops, where a floating bar would just waste a column.
 */
export function ParticipantNav({
  round,
  active,
  summary,
  progress,
}: ParticipantNavProps) {
  const read = useStorylineRead(summary);
  const slug = SLUG[round];

  return (
    <nav
      aria-label="Investigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-abyss-950/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)] lg:static lg:border-x-0 lg:border-b lg:border-t-0 lg:bg-abyss-950/50 lg:pb-0",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-stretch lg:px-8">
        <ul className="grid w-full grid-cols-3 gap-px lg:flex lg:w-auto lg:gap-1 lg:py-2">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            const Icon = tab.icon;
            const isStoryline = tab.key === "storyline";
            const unseen = isStoryline ? read.unseen : 0;
            return (
              <li key={tab.key} className="min-w-0 lg:w-auto">
                <Link
                  href={tab.href(slug)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    isStoryline && unseen > 0
                      ? `Storyline, ${unseen} unread case ${unseen === 1 ? "update" : "updates"}`
                      : tab.label
                  }
                  className={cn(
                    "group relative flex h-full flex-col items-center justify-center gap-1.5 px-1 py-2.5",
                    "transition-colors duration-150 lg:flex-row lg:gap-2.5 lg:rounded-none lg:px-4 lg:py-2",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acid",
                    isActive
                      ? "text-acid"
                      : "text-dim hover:bg-acid/5 hover:text-mist active:bg-acid/10",
                  )}
                >
                  {/* Active marker: a rule on phones, a left tick on desktop. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 top-0 h-px bg-acid transition-opacity duration-150 lg:hidden",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-4 w-px bg-acid transition-opacity duration-150 lg:block",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-150 lg:h-4 lg:w-4",
                      isActive ? "scale-100" : "group-hover:scale-[1.04]",
                    )}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] lg:text-[11px] lg:tracking-[0.22em]">
                    {tab.label}
                  </span>
                  {isStoryline ? <UnreadDot count={unseen} hydrated={read.hydrated} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Orientation line — desktop only, where the strip has room for it. */}
        {progress ? (
          <p className="ml-auto hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim lg:flex">
            <span className="text-mist">
              {progress.solved}/{progress.total}
            </span>
            links broken
            {progress.currentCode ? (
              <>
                <span aria-hidden className="text-line">
                  ·
                </span>
                <span className="text-caution">on {progress.currentCode}</span>
              </>
            ) : (
              <span>
                <span aria-hidden className="text-line">
                  ·
                </span>
                chain closed
              </span>
            )}
          </p>
        ) : null}
      </div>
    </nav>
  );
}
