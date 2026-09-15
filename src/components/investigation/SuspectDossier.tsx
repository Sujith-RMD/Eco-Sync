"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * SuspectDossier — a physical case folder for suspect presentation.
 *
 * On desktop: slightly layered dossiers with 3D tilt on hover.
 * On mobile: simpler depth, readable and accessible.
 *
 * The dossier feels like a physical file folder sitting on the evidence desk.
 */
interface SuspectDossierProps {
  children: ReactNode;
  className?: string;
  index?: number;
  isVerdict?: boolean;
  onClick?: () => void;
}

export function SuspectDossier({
  children,
  className,
  index = 0,
  isVerdict = false,
  onClick,
}: SuspectDossierProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <li
      className={cn(
        "relative border-b border-line/50 transition-all duration-300",
        "last:border-b-0",
        isVerdict ? "bg-alert/[0.06]" : "hover:bg-acid/[0.04]",
        onClick && "cursor-pointer",
        className,
      )}
      style={{
        transformStyle: "preserve-3d",
        transform: isHovered && !isVerdict
          ? `translateY(-2px) translateZ(4px) rotateX(1deg)`
          : "translateZ(0)",
        boxShadow: isHovered && !isVerdict
          ? "0 8px 24px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)"
          : "none",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </li>
  );
}
