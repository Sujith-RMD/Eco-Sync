import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

/** Labeled field wrapper with terminal-style marker. */
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="flex min-w-0 items-center gap-2.5 font-mono text-[10px] uppercase leading-snug tracking-[0.16em] text-mist sm:text-[11px] sm:tracking-[0.3em]"
      >
        <span aria-hidden className="h-[9px] w-[2px] shrink-0 bg-acid/80" />
        <span className="min-w-0 break-words">{label}</span>
      </label>
      {children}
      {hint ? (
        <p className="font-mono text-[11px] leading-relaxed text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Note the deliberate 16px type below `sm`: iOS Safari auto-zooms the viewport
 * when a focused input is smaller than 16px, which left every answer field on
 * this app zoomed-in and sideways on a phone.
 */
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full min-w-0 border border-line bg-abyss-950/80 px-3.5 py-3 font-mono text-base tracking-wide text-ink caret-acid sm:px-4 sm:text-sm",
        "placeholder:text-dim/60 transition-all duration-150",
        "focus:border-acid/70 focus:shadow-[0_0_0_3px_rgba(61,255,178,0.13)] focus:outline-none",
        props.className,
      )}
    />
  );
}
