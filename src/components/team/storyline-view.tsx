"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  CheckCircle2,
  FileText,
  Hourglass,
  Lock,
  Radio,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { selectUnreadBeats, type StorylineBeat } from "@/lib/storyline/beats";
import { useStorylineRead } from "@/lib/storyline/use-storyline-read";
import type { StorylineSummary } from "@/lib/storyline/summary";
import { toEventClock } from "@/lib/utils/time";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";

interface StorylineViewProps {
  beats: StorylineBeat[];
  summary: StorylineSummary;
  roundStatus: string;
  progress: { solved: number; total: number; currentCode: string | null } | null;
  /** Set when the unit can see the file but has produced nothing yet. */
  openedAt: string | null;
}

const kindMeta = {
  ROUND_OPENED: { icon: Radio, tone: "text-acid", label: "opening" },
  BRIEFING_RECEIVED: { icon: FileText, tone: "text-mist", label: "directive" },
  LINK_BROKEN: { icon: CheckCircle2, tone: "text-acid", label: "link broken" },
  ROUND_ENDED: { icon: Hourglass, tone: "text-dim", label: "closed" },
} as const;

function BeatRow({ beat, isNew }: { beat: StorylineBeat; isNew: boolean }) {
  const meta = kindMeta[beat.kind];
  const Icon = meta.icon;
  return (
    <li
      className={cn(
        "relative pl-8 sm:pl-10",
        isNew && "animate-reveal-up",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 flex h-6 w-6 items-center justify-center border sm:h-7 sm:w-7",
          isNew
            ? "border-caution/60 bg-caution/10 text-caution"
            : "border-line/80 bg-abyss-950/60",
          meta.tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 space-y-1.5 pb-7">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="min-w-0 break-words font-mono text-[11px] uppercase leading-snug tracking-[0.14em] text-ink sm:text-[12px] sm:tracking-[0.2em]">
            {beat.title}
          </p>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]",
              isNew ? "text-caution" : "text-dim",
            )}
          >
            {isNew ? "new" : meta.label}
          </span>
          {beat.at ? (
            <time
              dateTime={beat.at}
              className="shrink-0 font-mono text-[10px] tabular-nums tracking-[0.1em] text-dim"
            >
              {toEventClock(beat.at)} IST
            </time>
          ) : null}
        </div>
        {beat.detail ? (
          <p className="min-w-0 break-words whitespace-pre-line text-[13px] leading-relaxed text-mist sm:text-sm">
            {beat.kind === "BRIEFING_RECEIVED" ? (
              <span aria-hidden className="mr-1.5 text-dim/70">
                ›
              </span>
            ) : null}
            {beat.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The case file: what happened, in order, derived entirely from the unit's own
 * progression.
 *
 * Locked links contribute nothing, so the file can never spoil ahead; the count
 * of sealed links is stated instead, which keeps "how much is left" answerable
 * without revealing what is left.
 *
 * On opening, the beats the unit had not seen are rendered as new for this
 * visit and the reading cursor advances — so the badge clears and the same
 * unlock is never announced twice, even by refresh.
 */
export function StorylineView({
  beats,
  summary,
  roundStatus,
  progress,
  openedAt,
}: StorylineViewProps) {
  const { hydrated, seen, markRead } = useStorylineRead(summary);
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const settled = useRef(false);

  // The cursor only exists once the store settles one render after hydration, so
  // the "new" set is captured from that first real reading position and then
  // applied on a short delay: long enough that the badge clearing and the rows
  // flagging themselves read as one deliberate act, short enough that nobody
  // thinks the interface is loading. Deliberately one-shot per visit — a beat
  // flagged here is a claim about this visit, not permanent metadata.
  useEffect(() => {
    if (!hydrated || settled.current) return;
    settled.current = true;
    const captured = selectUnreadBeats(
      { beats, size: beats.length },
      seen,
    ).map((beat) => beat.id);
    const timer = setTimeout(() => {
      if (captured.length > 0) setNewIds(new Set(captured));
      markRead();
    }, 700);
    return () => clearTimeout(timer);
  }, [hydrated, seen, markRead, beats]);

  const sealedCount =
    progress === null ? 0 : Math.max(0, progress.total - progress.solved);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-line/70 bg-abyss-900/50 px-3.5 py-2.5 sm:px-4">
        <StatusPill
          tone={roundStatus === "ACTIVE" ? "ok" : roundStatus === "ENDED" ? "muted" : "warn"}
          label={
            roundStatus === "ACTIVE"
              ? "investigation live"
              : roundStatus === "ENDED"
                ? "file closed"
                : "awaiting go-signal"
          }
        />
        {progress ? (
          <p className="font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-dim sm:text-[11px] sm:tracking-[0.22em]">
            <span className="text-ink">{progress.solved}</span>
            <span className="text-dim">/{progress.total}</span> links broken
            {progress.currentCode ? (
              <>
                <span aria-hidden className="mx-2 text-line">
                  |
                </span>
                working on{" "}
                <span className="text-caution">{progress.currentCode}</span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim sm:text-[11px] sm:tracking-[0.22em]">
            nothing recovered yet
          </p>
        )}
        {openedAt ? (
          <p className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-dim sm:text-[11px] sm:tracking-[0.22em]">
            opened{" "}
            <time dateTime={openedAt} className="text-mist tabular-nums">
              {toEventClock(openedAt)}
            </time>{" "}
            IST
          </p>
        ) : null}
      </div>

      <Panel
        title="Case file"
        aside={
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
            <ScrollText className="h-3.5 w-3.5" />
            {beats.length} entr{beats.length === 1 ? "y" : "ies"}
          </span>
        }
      >
        {beats.length === 0 ? (
          <div className="flex items-start gap-3">
            <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
            <p className="font-mono text-[12px] leading-relaxed text-dim">
              The file is empty. Command has not opened this round for your unit,
              so nothing has been transmitted yet — briefings arrive here the
              moment they unseal.
            </p>
          </div>
        ) : (
          <ol className="relative">
            {/* Single rail down the left edge: one line, not a stack of boxes. */}
            <span
              aria-hidden
              className="absolute left-3 top-2 bottom-2 w-px bg-line/70 sm:left-[13.5px]"
            />
            {beats.map((beat) => (
              <BeatRow key={beat.id} beat={beat} isNew={newIds.has(beat.id)} />
            ))}
          </ol>
        )}
      </Panel>

      {sealedCount > 0 ? (
        <p className="flex items-start gap-2.5 border border-line/60 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-dim">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {sealedCount} link{sealedCount === 1 ? "" : "s"} still sealed. Sealed
          links are not summarised here — no title, no briefing, no preview.
        </p>
      ) : null}
    </div>
  );
}
