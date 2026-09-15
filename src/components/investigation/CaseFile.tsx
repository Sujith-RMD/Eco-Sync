import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * CaseFile — a reusable 3D layered container for investigation content.
 *
 * Creates the visual effect of documents and panels sitting at different
 * depths on the evidence desk. The `depth` prop controls how "raised"
 * the content appears from the surface.
 *
 * 70-80% 2D, 20-30% purposeful 3D depth.
 */
interface CaseFileProps {
  children: ReactNode;
  className?: string;
  depth?: "surface" | "raised" | "elevated";
  animate?: boolean;
}

export function CaseFile({
  children,
  className,
  depth = "surface",
  animate = true,
}: CaseFileProps) {
  const depthStyles = {
    surface: {
      transform: "translateZ(0)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(240,236,229,0.05)",
    },
    raised: {
      transform: "translateZ(8px)",
      boxShadow:
        "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(240,236,229,0.06)",
    },
    elevated: {
      transform: "translateZ(16px)",
      boxShadow:
        "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(240,236,229,0.08)",
    },
  };

  return (
    <div
      className={cn(
        "relative",
        animate && "evidence-reveal",
        className,
      )}
      style={{
        transformStyle: "preserve-3d",
        ...depthStyles[depth],
      }}
    >
      {children}
    </div>
  );
}
