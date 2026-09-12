import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type StatusTone = "ok" | "warn" | "alert" | "muted";

const toneClasses: Record<StatusTone, string> = {
  ok: "border-acid/40 bg-acid/10 text-acid",
  warn: "border-caution/40 bg-caution/10 text-caution",
  alert: "border-alert/40 bg-alert/10 text-alert",
  muted: "border-line bg-abyss-900/60 text-mist",
};

interface StatusPillProps {
  tone?: StatusTone;
  label: ReactNode;
  /** Disable the pulsing indicator dot. */
  staticDot?: boolean;
  className?: string;
}

/** Compact telemetry-style status indicator. */
export function StatusPill({
  tone = "ok",
  label,
  staticDot = false,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase leading-snug tracking-[0.14em] sm:gap-2 sm:px-2.5 sm:text-[10px] sm:tracking-[0.24em]",
        toneClasses[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
          !staticDot && "animate-blink-dot",
        )}
      />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}
