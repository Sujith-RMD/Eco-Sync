import { cn } from "@/lib/utils/cn";

/**
 * The case-file strip that sits above a panel on the entry screens.
 *
 * Identity first, then the surface's own label, then the standing facts about
 * the case in one line of mono. Small on purpose: on /login and /admin/login
 * this is the first thing a team or an operator reads, and it should establish
 * that they are opening a file rather than signing into a product — without
 * competing with the panel underneath, which is the thing they have to act on.
 */
export function CaseFileHeader({
  /** What this surface is, in case-file terms. */
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line/70 pb-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink sm:text-[12px] sm:tracking-[0.2em]">
          ECOSYNC-07-BREACH
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
          {label}
        </p>
      </div>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        Case No. 07 · Operation Breach · Custody open
      </p>
    </div>
  );
}
