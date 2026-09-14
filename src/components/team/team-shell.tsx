import Link from "next/link";
import type { ReactNode } from "react";
import { Binoculars } from "lucide-react";
import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonClasses } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { ParticipantNav, type ParticipantTab } from "@/components/team/participant-nav";
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
 * notice — assembled once so the case file, the answer console and the roster
 * cannot drift apart in spacing, padding or navigation state.
 *
 * `padding-bottom` reserves the height of the fixed tab bar plus the iPhone
 * home-indicator area; without it the last card of a long chain sits underneath
 * the bar and cannot be reached.
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
      <Backdrop />
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

      <ParticipantNav
        round={round}
        active={active}
        summary={summary}
        progress={progress}
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pb-[7.5rem] pt-6 sm:px-8 sm:pb-10 lg:pb-12 lg:pt-8">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 mb-5 break-words font-display text-[22px] font-bold leading-tight tracking-tight text-ink sm:mb-7 sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {children}
      </main>

      <StorylineToast summary={summary} onStoryline={active === "storyline"} />
    </div>
  );
}
