import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PanelProps {
  title?: ReactNode;
  /** Right-aligned header content (pills, actions). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

function CornerBrackets() {
  const base = "pointer-events-none absolute h-3.5 w-3.5 border-acid/60";
  return (
    <>
      <span aria-hidden className={cn(base, "-left-px -top-px border-l-2 border-t-2")} />
      <span aria-hidden className={cn(base, "-right-px -top-px border-r-2 border-t-2")} />
      <span aria-hidden className={cn(base, "-bottom-px -left-px border-b-2 border-l-2")} />
      <span aria-hidden className={cn(base, "-bottom-px -right-px border-b-2 border-r-2")} />
    </>
  );
}

/** Framed ops-console panel with corner brackets. */
export function Panel({
  title,
  aside,
  children,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        "relative border border-line/80 bg-abyss-900/70 backdrop-blur-md",
        className,
      )}
    >
      <CornerBrackets />
      {title || aside ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line/70 px-3.5 py-3 sm:px-5 sm:py-3.5">
          <h2 className="flex min-w-0 items-center gap-2.5 font-mono text-[10px] font-medium uppercase leading-snug tracking-[0.16em] text-acid sm:text-[11px] sm:tracking-[0.32em]">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-acid" />
            <span className="min-w-0 break-words">{title}</span>
          </h2>
          {aside ? (
            <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
              {aside}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn("px-3.5 py-4 sm:px-5 sm:py-5", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
