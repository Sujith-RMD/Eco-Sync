"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * CaseTimeline3D — a physical investigation timeline for storyline beats.
 *
 * Each event is anchored to a subtle 3D investigation surface with
 * evidence markers. When unlocked, the marker activates and the
 * document slides forward. Recently unlocked information gets a
 * restrained visual pulse.
 */
interface TimelineEvent {
  id: string;
  title: string;
  detail?: string;
  kind: string;
  timestamp?: string;
  isNew?: boolean;
}

interface CaseTimeline3DProps {
  events: TimelineEvent[];
  children: ReactNode;
  className?: string;
}

export function CaseTimeline3D({
  events,
  children,
  className,
}: CaseTimeline3DProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}

/**
 * TimelineMarker — a physical evidence marker on the investigation surface.
 */
export function TimelineMarker({
  kind,
  isNew,
  isActive,
  children,
}: {
  kind: string;
  isNew?: boolean;
  isActive?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "relative pl-8 sm:pl-10",
        isNew && "evidence-reveal",
      )}
    >
      {/* Evidence marker */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 flex h-6 w-6 items-center justify-center border sm:h-7 sm:w-7",
          "transition-all duration-300",
          isNew && "animate-marker-activate",
          isActive
            ? "border-caution/60 bg-caution/10 text-caution"
            : "border-line/80 bg-abyss-950/60",
        )}
      >
        {children}
      </span>
    </li>
  );
}
