import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * EvidenceObject — visual hierarchy between evidence types.
 *
 * Each evidence type has a distinct but restrained presentation:
 * DOCUMENT, PHOTOGRAPH, SURVEILLANCE, SYSTEM LOG, HANDWRITTEN NOTE,
 * NEWSPAPER, EVIDENCE FILE.
 *
 * Realistic visual metaphors, not random 3D icons.
 */
type EvidenceType =
  | "document"
  | "photograph"
  | "surveillance"
  | "system-log"
  | "handwritten"
  | "newspaper"
  | "evidence-file";

interface EvidenceObjectProps {
  type: EvidenceType;
  children: ReactNode;
  className?: string;
  isNew?: boolean;
}

const TYPE_STYLES: Record<EvidenceType, string> = {
  document: "border-evidence-edge/30 bg-evidence-paper/[0.03]",
  photograph: "border-line/60 bg-abyss-900/80",
  surveillance: "border-pulse/30 bg-pulse/5",
  "system-log": "border-acid/20 bg-acid/5",
  handwritten: "border-caution/30 bg-caution/5",
  newspaper: "border-evidence-edge/40 bg-evidence-paper/[0.04]",
  "evidence-file": "border-line/70 bg-abyss-900/60",
};

export function EvidenceObject({
  type,
  children,
  className,
  isNew,
}: EvidenceObjectProps) {
  return (
    <div
      className={cn(
        "border px-3.5 py-3 font-mono text-[12px] leading-relaxed",
        "transition-all duration-300",
        TYPE_STYLES[type],
        isNew && "evidence-reveal",
        className,
      )}
    >
      {children}
    </div>
  );
}
