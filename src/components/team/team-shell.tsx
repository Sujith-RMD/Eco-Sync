import Link from "next/link";
import type { ReactNode } from "react";
import { Binoculars } from "lucide-react";
import { InvestigationEnvironment } from "@/components/investigation/InvestigationEnvironment";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { InvestigationNav, type ParticipantTab } from "@/components/investigation/InvestigationNav";
import { StorylineToast } from "@/components/team/storyline-toast";
import type { StorylineSummary } from "@/lib/storyline/summary";
import type { RoundCode } from "@/types/game";

interface TeamShellProps {
  round: RoundCode;
  active: ParticipantTab;
  summary: StorylineSummary;
  progress: { solved: number; total: number; currentCode: string | null } | null;
  eyebrow: string;
  title: string;
  teamName: string;
  children: ReactNode;
}

const ROUND_LABEL: Record<RoundCode, string> = {
  ROUND_1: "round 01",
  ROUND_2: "round 02",
};

/**
 * Participant chrome: identity, the three-way navigation, and the unlock
 * notice — wrapped in the investigation environment with 3D depth framing.
 */
export function TeamShell({
  round,
  active,
  summary,
  progress,
  eyebrow,
  title,
  teamName,
  children,
}: TeamShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <InvestigationEnvironment />
      <Topbar>
        <StatusPill tone="ok" label={`team // ${teamName}`} />
        <StatusPill tone="muted" label={ROUND_LABEL[round]} staticDot />
        <Link
          href="/lobby"
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          <Binoculars className="h-3.5 w-3.5" />
          Lobby
        </Link>
        <LogoutButton />
      </Topbar>

      <InvestigationNav
        round={round}
        active={active}
        summary={summary}
        progress={progress}
      />

      {/* Main content area with 3D investigation framing */}
      <main
        className="relative z-10 mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pb-[7.5rem] pt-6 sm:px-8 sm:pb-10 lg:pb-12 lg:pt-8"
        style={{ perspective: "1200px", perspectiveOrigin: "50% 20%" }}
      >
        <div className="layer-3d">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1
            className="mt-3 mb-5 break-words font-display text-[22px] font-bold leading-tight tracking-tight text-ink sm:mb-7 sm:text-3xl md:text-4xl"
            style={{ transform: "translateZ(4px)" }}
          >
            {title}
          </h1>
          <div style={{ transform: "translateZ(2px)" }}>
            {children}
          </div>
        </div>
      </main>

      <StorylineToast summary={summary} onStoryline={active === "storyline"} />
    </div>
  );
}
