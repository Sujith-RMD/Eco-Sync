import { Gavel, Lock, ScrollText, UserSearch } from "lucide-react";
import type { RoundCode, VoteSnapshot } from "@/types/game";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { VotePanel } from "@/components/game/vote-panel";
import { CaseFile } from "@/components/investigation/CaseFile";
import { SuspectDossier } from "@/components/investigation/SuspectDossier";
import { cn } from "@/lib/utils/cn";

interface SuspectsBoardProps {
  round: RoundCode;
  vote: VoteSnapshot | undefined;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function DossierRow({
  index,
  name,
  role,
  isVerdict,
}: {
  index: number;
  name: string;
  role: string;
  isVerdict: boolean;
}) {
  return (
    <SuspectDossier index={index} isVerdict={isVerdict}>
      <div className="flex items-start gap-3 px-3.5 py-4 sm:px-5">
        {/* Suspect monogram — physical evidence marker */}
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center border font-display text-[13px] font-bold tracking-tight",
            "transition-all duration-300",
            isVerdict
              ? "border-alert/50 bg-alert/10 text-alert"
              : "border-line bg-abyss-950/60 text-mist",
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="min-w-0 break-words font-display text-[15px] font-semibold tracking-wide text-ink sm:text-base">
              {name}
            </h3>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-dim sm:tracking-[0.26em]">
              subject {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <p className="min-w-0 break-words font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-dim sm:text-[11px] sm:tracking-[0.2em]">
            {role}
          </p>
          {isVerdict ? (
            <p className="flex items-center gap-1.5 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-alert">
              <Gavel className="h-3 w-3" />
              your team&apos;s sealed verdict
            </p>
          ) : null}
        </div>
      </div>
    </SuspectDossier>
  );
}

/**
 * Suspect dossiers — now presented as physical case folders with 3D depth.
 * On desktop, dossiers tilt on hover. On mobile, simpler depth.
 */
export function SuspectsBoard({ round, vote }: SuspectsBoardProps) {
  if (!vote) {
    return (
      <CaseFile depth="surface">
        <Panel
          title="Suspect dossiers"
          aside={
            <StatusPill
              tone="muted"
              label={`${round === "ROUND_1" ? "round 01" : "round 02"} · sealed`}
              staticDot
            />
          }
        >
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
            <div className="min-w-0 space-y-3">
              <p className="font-mono text-[12px] leading-relaxed text-mist">
                Command holds the suspect roster. Round 01 recovers the breach
                itself — the people who could have done it are named in the next
                phase, once the field is cut to the qualifying teams.
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim sm:tracking-[0.24em]">
                No subjects to examine in this round.
              </p>
            </div>
          </div>
        </Panel>
      </CaseFile>
    );
  }

  const verdictSuspect = vote.submitted
    ? vote.suspects.find((suspect) => suspect.code === vote.suspectCode)
    : undefined;

  const rosterState = vote.submitted
    ? "verdict sealed"
    : vote.unlocked
      ? "vote open — ballot below"
      : "read-only · vote sealed";

  return (
    <div className="space-y-4 perspective-container">
      {/* Suspect roster — 3D layered case file */}
      <CaseFile depth="raised">
        <Panel
          title={`Roster — ${vote.suspects.length} subjects inside the perimeter`}
          aside={
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
              <UserSearch className="h-3.5 w-3.5" />
              {rosterState}
            </span>
          }
          contentClassName="p-0"
        >
          <ul>
            {vote.suspects.map((suspect, index) => (
              <DossierRow
                key={suspect.code}
                index={index}
                name={suspect.name}
                role={suspect.role}
                isVerdict={verdictSuspect?.code === suspect.code}
              />
            ))}
          </ul>
        </Panel>
      </CaseFile>

      {/* Evidence note */}
      <CaseFile depth="surface" animate={false}>
        <div className="space-y-3 border border-line/60 px-3.5 py-3">
          <p className="flex items-start gap-2.5 font-mono text-[11px] leading-relaxed text-dim">
            <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Roles are the only particulars command has released on these subjects.
            Statements, logs and the newspaper are physical evidence — your team
            reads them in the room, and nothing here paraphrases them.
          </p>
          {!vote.submitted && !vote.unlocked ? (
            <p className="flex items-start gap-2.5 font-mono text-[11px] leading-relaxed text-mist">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Read-only for now: nothing in this roster can be selected until the
              final code breaks. The ballot appears below this roster, on this tab.
            </p>
          ) : null}
        </div>
      </CaseFile>

      <VotePanel vote={vote} />
    </div>
  );
}
