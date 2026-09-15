import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

interface TopbarProps {
  children?: ReactNode;
}

/** Shared top chrome: brand identity + right-aligned status/actions slot. */
export function Topbar({ children }: TopbarProps) {
  return (
    <header className="relative z-20 border-b border-line/70 bg-abyss-950/70 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:gap-6 sm:px-8 sm:py-0">
        {/*
          Deliberately not a link. It used to point at "/", which yanked teams
          out of their round console and operators out of the deck the moment
          they tapped the logo on a phone. Navigation lives in the real controls
          (Lobby button, back links, deck tabs).
        */}
        <span className="flex min-w-0 select-none items-center gap-2.5 sm:gap-3">
          <span className="shrink-0 text-acid">
            <LogoMark className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="flex min-w-0 flex-col justify-center leading-none">
            <span className="truncate font-mono text-[13px] font-semibold tracking-[0.2em] text-ink sm:text-sm sm:tracking-[0.32em]">
              ECO-SYNC
            </span>
            {/* Tagline is the first thing to go on a phone. */}
            <span className="mt-1.5 hidden font-mono text-[9px] uppercase tracking-[0.42em] text-dim sm:block">
              The Breach · Cryptic Room
            </span>
          </span>
        </span>
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {children}
        </div>
      </div>
    </header>
  );
}
