"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------------- */
/* Server-synced countdown (server clock is authoritative; this is cosmetic)   */
/* -------------------------------------------------------------------------- */

interface ServerCountdownProps {
  /** ISO timestamp of round end (from the server). */
  endsAt: string | null;
  /** ISO server time captured at render — used to compute clock skew. */
  serverTime: string;
  className?: string;
  expiredLabel?: string;
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ServerCountdown({
  endsAt,
  serverTime,
  className,
  expiredLabel = "TIME EXPIRED",
}: ServerCountdownProps) {
  const skewRef = useRef<number>(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    endsAt ? Math.max(0, Date.parse(endsAt) - Date.parse(serverTime)) : null,
  );

  useEffect(() => {
    if (!endsAt) return;
    skewRef.current = Date.parse(serverTime) - Date.now();
    const ends = Date.parse(endsAt);
    const tick = () =>
      setRemainingMs(Math.max(0, ends - (Date.now() + skewRef.current)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt, serverTime]);

  if (!endsAt) {
    return <span className={cn("tabular-nums", className)}>--:--</span>;
  }

  const totalSeconds = Math.floor((remainingMs ?? 0) / 1000);

  if (totalSeconds <= 0 && remainingMs !== null) {
    return (
      <span className={cn("tabular-nums text-alert", className)}>
        {expiredLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "tabular-nums",
        totalSeconds < 300 ? "text-alert" : totalSeconds < 600 ? "text-caution" : "text-ink",
        className,
      )}
    >
      {formatClock(totalSeconds)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Submission-lockout badge (visual countdown; server enforces the real gate)  */
/* -------------------------------------------------------------------------- */

interface LockoutBadgeProps {
  lockedUntil: string;
  /** Notified with remaining seconds on every tick (0 = lifted). */
  onTick?: (remainingSeconds: number) => void;
  className?: string;
}

export function LockoutBadge({ lockedUntil, onTick, className }: LockoutBadgeProps) {
  const target = Date.parse(lockedUntil);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((target - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(left);
    }, 250);
    return () => clearInterval(interval);
  }, [target]);

  useEffect(() => {
    onTick?.(remaining);
  }, [remaining, onTick]);

  if (remaining <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-caution/40 bg-caution/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-caution",
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current animate-blink-dot" />
      Lockout {remaining}s
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Periodic server refresh (keeps console state convergent on all devices)     */
/* -------------------------------------------------------------------------- */

export function AutoRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, router]);

  return null;
}
