import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InvestigationEnvironment } from "@/components/investigation/InvestigationEnvironment";
import { Topbar } from "@/components/layout/topbar";
import { buttonClasses } from "@/components/ui/button";

/*
  The landing page: a classified case file sitting on an investigation desk.
  The first screen should be cinematic — a dark environment, subtle ambient light,
  a physical-looking case file in 3D space.
*/
const PARAMETERS = [
  { label: "Field", value: "61", sub: "teams deployed" },
  { label: "Round 01", value: "45:00", sub: "top 15 advance" },
  { label: "Round 02", value: "60:00", sub: "3 teams prevail" },
  { label: "Verdict", value: "Sealed", sub: "culprit vote" },
] as const;

const TICKER_ITEMS = [
  "ECO-SYNC",
  "Evidence first",
  "Trust the proof",
  "61 teams deployed",
  "The Breach protocol",
] as const;

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <InvestigationEnvironment />
      <Topbar />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-8">
        <section className="flex flex-1 flex-col justify-center py-10 sm:py-16">
          {/* Case file identity — printed/embedded into the investigation surface */}
          <div className="perspective-container">
            <h1
              className="font-display font-bold leading-[0.9] tracking-tight layer-3d"
              style={{ transform: "translateZ(12px)" }}
            >
              <span className="reveal reveal-1 block text-[clamp(2.5rem,11.5vw,8.5rem)] text-ink">
                ECO-SYNC
              </span>
              <span className="text-outline reveal reveal-2 mt-2 block text-[clamp(1.65rem,8vw,6.25rem)] font-serif italic tracking-[0.04em] sm:tracking-[0.08em]">
                THE BREACH
              </span>
            </h1>
          </div>

          {/* Case status — investigation header */}
          <div className="reveal reveal-2 mt-4 flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-caution animate-blink-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-caution">
              Case File // Active
            </span>
          </div>

          <p className="reveal reveal-3 mt-6 max-w-xl text-base leading-relaxed text-mist sm:mt-8 sm:text-lg">
            Sixty-one teams enter a compromised facility. Read the room. Trace the
            evidence. Expose the insider before the trail goes cold.
          </p>

          {/* Primary action — ENTER INVESTIGATION */}
          <div className="reveal reveal-4 mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link
              href="/login"
              className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}
            >
              Enter investigation
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Link>
            <Link
              href="/admin/login"
              className={buttonClasses({
                variant: "ghost",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
            >
              Command deck
            </Link>
          </div>
        </section>

        {/* Investigation parameters — case metadata */}
        <section className="reveal reveal-4 border-t border-line/70">
          <dl className="grid grid-cols-2 gap-y-8 py-8 sm:grid-cols-4 sm:gap-x-6">
            {PARAMETERS.map((param) => (
              <div key={param.label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim sm:tracking-[0.34em]">
                  {param.label}
                </dt>
                <dd className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
                  {param.value}
                </dd>
                <dd className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-mist/70">
                  {param.sub}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      {/* Ticker — investigation status feed */}
      <footer className="relative z-10 overflow-hidden border-t border-line/70 bg-abyss-950/60 py-2.5">
        <div
          aria-hidden
          className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.4em] text-dim/70"
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
            <span key={index} className="flex items-center gap-10">
              <span>{item}</span>
              <span className="text-acid/60">{"//"}</span>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
