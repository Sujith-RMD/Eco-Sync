"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * InvestigationEnvironment — the persistent 3D evidence desk behind the interface.
 *
 * A dark desk surface with subtle depth: matte charcoal base, faint directional
 * lighting from above, soft shadow layers, and controlled parallax on mouse move.
 * Pure CSS 3D — no WebGL for the desk itself, keeping performance high on phones.
 *
 * The environment should feel like "someone built a sophisticated investigation
 * terminal on an actual evidence desk."
 *
 * PERFORMANCE: Uses refs and CSS custom properties for parallax instead of
 * React state, avoiding full re-renders on every mouse move.
 */
export function InvestigationEnvironment({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only apply parallax on desktop for performance
    const mql = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    if (!mql.matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        // Update CSS custom properties directly — no React re-render.
        container.style.setProperty("--parallax-x", `${(x - 0.5) * 8}`);
        container.style.setProperty("--parallax-y", `${(y - 0.5) * 5}`);
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden",
        className,
      )}
      style={
        {
          perspective: "1200px",
          perspectiveOrigin: "50% 30%",
          "--parallax-x": "0",
          "--parallax-y": "0",
        } as React.CSSProperties
      }
    >
      {/* Desk surface — matte charcoal with subtle grain */}
      <div
        className="absolute inset-0 desk-surface"
        style={{
          transform: `translateZ(-10px) scale(1.02)`,
          transformStyle: "preserve-3d",
        }}
      />

      {/* Directional light from above — soft, neutral */}
      <div
        className="absolute -top-32 left-1/2 h-[500px] w-[min(900px,95vw)] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(240,236,229,0.06) 0%, transparent 70%)",
          transform: `translateZ(-5px) translate(calc(var(--parallax-x) * 0.3px), calc(var(--parallax-y) * 0.3px))`,
        }}
      />

      {/* Ambient desk shadow — bottom vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, rgba(14,13,12,0.8) 0%, transparent 40%)",
        }}
      />

      {/* Side shadow layers — depth cues */}
      <div
        className="absolute -left-20 top-1/4 h-[60%] w-40"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.3), transparent)",
          transform: `translateZ(-8px) translate(calc(var(--parallax-x) * 0.5px), 0)`,
        }}
      />
      <div
        className="absolute -right-20 top-1/4 h-[60%] w-40"
        style={{
          background: "linear-gradient(to left, rgba(0,0,0,0.3), transparent)",
          transform: `translateZ(-8px) translate(calc(var(--parallax-x) * -0.5px), 0)`,
        }}
      />

      {/* Faint evidence papers scattered on desk — decorative, non-interactive */}
      <div
        className="absolute left-[8%] top-[15%] h-32 w-24 opacity-[0.04]"
        style={{
          background: "var(--color-evidence-paper)",
          transform: `translateZ(-6px) rotate(-3deg) translate(calc(var(--parallax-x) * 0.4px), calc(var(--parallax-y) * 0.4px))`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      />
      <div
        className="absolute right-[12%] top-[22%] h-28 w-20 opacity-[0.03]"
        style={{
          background: "var(--color-evidence-paper)",
          transform: `translateZ(-7px) rotate(2deg) translate(calc(var(--parallax-x) * -0.3px), calc(var(--parallax-y) * 0.3px))`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      />
      <div
        className="absolute left-[22%] bottom-[20%] h-20 w-28 opacity-[0.025]"
        style={{
          background: "var(--color-evidence-paper)",
          transform: `translateZ(-5px) rotate(-1.5deg) translate(calc(var(--parallax-x) * 0.2px), calc(var(--parallax-y) * 0.2px))`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      />

      {/* Archive grain overlay */}
      <div className="absolute inset-0 bg-archive opacity-[0.03]" />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 95% at 50% 8%, transparent 42%, rgba(14,13,12,0.92) 100%)",
        }}
      />
    </div>
  );
}
