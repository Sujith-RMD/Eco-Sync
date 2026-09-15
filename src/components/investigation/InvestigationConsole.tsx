import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * InvestigationConsole — the answer interface framed inside the 3D environment.
 *
 * The input itself remains a standard accessible 2D control. The console
 * provides subtle 3D framing: a raised surface with document-edge shadows,
 * a status bar, and a clear visual hierarchy for the puzzle information.
 */
interface InvestigationConsoleProps {
  children: ReactNode;
  className?: string;
  status?: "active" | "verified" | "error" | "locked";
}

export function InvestigationConsole({
  children,
  className,
  status = "active",
}: InvestigationConsoleProps) {
  return (
    <div
      className={cn(
        "console-frame relative overflow-hidden",
        className,
      )}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {/* Status indicator bar */}
      <div
        className={cn(
          "h-0.5 w-full transition-colors duration-300",
          status === "active" && "bg-caution/60",
          status === "verified" && "bg-confirm/60",
          status === "error" && "bg-alert/60",
          status === "locked" && "bg-line/60",
        )}
      />

      {/* Console content */}
      <div className="relative p-4 sm:p-6">
        {children}
      </div>

      {/* Subtle corner fold — document feel */}
      <div
        className="absolute right-0 top-0 h-4 w-4 opacity-20"
        style={{
          background: "linear-gradient(225deg, var(--color-line) 50%, transparent 50%)",
        }}
      />
    </div>
  );
}
