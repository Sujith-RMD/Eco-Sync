"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * CaseTransition — the cinematic landing experience.
 *
 * Camera subtly moves toward the case file, the case opens,
 * interface layers unfold, and the main investigation UI appears.
 * Short and polished, no giant animation sequence.
 */
interface CaseTransitionProps {
  onComplete?: () => void;
}

export function CaseTransition({ onComplete }: CaseTransitionProps) {
  const [phase, setPhase] = useState<"initial" | "opening" | "complete">("initial");

  useEffect(() => {
    // Start the opening animation after a brief pause
    const startTimer = setTimeout(() => setPhase("opening"), 300);
    const completeTimer = setTimeout(() => {
      setPhase("complete");
      onComplete?.();
    }, 1500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (phase === "complete") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-abyss-950 transition-opacity duration-500",
        phase === "opening" && "opacity-0 pointer-events-none",
      )}
    >
      {/* Case file in 3D space */}
      <div
        className={cn(
          "relative w-[min(400px,85vw)] transition-all duration-700",
          phase === "initial" && "scale-95 opacity-0",
          phase === "opening" && "scale-100 opacity-100",
        )}
        style={{
          perspective: "800px",
          perspectiveOrigin: "50% 30%",
        }}
      >
        {/* Case file body */}
        <div
          className="relative border border-line/60 bg-abyss-900 p-8 sm:p-12"
          style={{
            transform: phase === "opening"
              ? "rotateX(0deg) translateY(0)"
              : "rotateX(-8deg) translateY(20px)",
            transformStyle: "preserve-3d",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          {/* ECO-SYNC identity */}
          <div className="text-center space-y-4">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              ECO-SYNC
            </h1>
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
                Case File // Active
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-caution">
                Investigation In Progress
              </p>
            </div>
          </div>

          {/* Decorative evidence markers */}
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid" />
          <div className="absolute -bottom-1 left-8 h-2 w-2 -translate-y-1/2 rounded-full bg-line" />
          <div className="absolute -bottom-1 right-8 h-2 w-2 -translate-y-1/2 rounded-full bg-line" />
        </div>
      </div>
    </div>
  );
}
