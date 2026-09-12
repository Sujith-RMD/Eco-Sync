import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type EyebrowTone = "acid" | "caution" | "pulse";

const toneClasses: Record<EyebrowTone, { text: string; rule: string }> = {
  acid: { text: "text-acid", rule: "bg-acid/70" },
  caution: { text: "text-caution", rule: "bg-caution/70" },
  pulse: { text: "text-pulse", rule: "bg-pulse/70" },
};

/**
 * Section eyebrow (the small tracked-out label above every page title).
 *
 * These were previously hand-rolled on each page at `tracking-[0.38em]` with no
 * wrapping, which measured ~500px for a sentence like
 * "Operation file 07 // Breach protocol active" and ran straight off the edge
 * of a phone. Shared here: wraps, and sheds letter-spacing below `sm`.
 */
export function Eyebrow({
  children,
  tone = "acid",
  className,
}: {
  children: ReactNode;
  tone?: EyebrowTone;
  className?: string;
}) {
  const palette = toneClasses[tone];
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase leading-snug tracking-[0.18em]",
        "sm:text-[11px] sm:tracking-[0.38em]",
        palette.text,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("h-px w-6 shrink-0 sm:w-10", palette.rule)}
      />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
