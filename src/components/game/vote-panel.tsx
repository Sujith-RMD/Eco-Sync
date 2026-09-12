"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Gavel,
  Loader2,
  Lock,
  UserCheck,
} from "lucide-react";
import { castVoteAction } from "@/server/team/actions";
import { initialVoteState, type VoteSnapshot } from "@/types/game";
import { cn } from "@/lib/utils/cn";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";

function SealButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="lg" disabled={disabled || pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
      {pending ? "Sealing verdict" : "Seal vote — final"}
    </Button>
  );
}

export function VotePanel({ vote }: { vote: VoteSnapshot }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, formAction] = useActionState(castVoteAction, initialVoteState);

  if (vote.submitted) {
    const chosen = vote.suspects.find((s) => s.code === vote.suspectCode);
    return (
      <Panel
        title="Final verdict — culprit vote"
        aside={<StatusPill tone="ok" label="sealed" staticDot />}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acid" />
          <div className="space-y-1">
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-acid">
              Your unit's verdict is sealed
            </p>
            <p className="font-display text-xl font-semibold text-ink">
              {chosen?.name ?? "—"}
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-dim">
              Timestamped in the custody chain. No changes are possible — by
              design. Whether the verdict was right will be decided by command.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (!vote.unlocked) {
    return (
      <Panel
        title="Final verdict — culprit vote"
        aside={<StatusPill tone="muted" label="sealed" staticDot />}
      >
        <p className="flex items-start gap-2.5 font-mono text-[12px] leading-relaxed text-dim">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          The culprit vote unseals only when your unit breaks THE VERDICT — the
          final code. Free-form accusations are not accepted: the verdict is
          chosen from the official suspect roster.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Final verdict — culprit vote"
      aside={<StatusPill tone="warn" label="one vote · irreversible" />}
    >
      <div className="space-y-5">
        <p className="font-mono text-[12px] leading-relaxed text-mist">
          Every evidence chain converges on one insider. Select your suspect,
          then seal the verdict. Your unit gets exactly one vote — timestamped,
          permanent, and hidden from other units.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Suspect roster">
          {vote.suspects.map((suspect) => {
            const isSelected = selected === suspect.code;
            return (
              <button
                key={suspect.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(suspect.code)}
                className={cn(
                  "group flex items-start gap-3 border px-4 py-3.5 text-left transition-all duration-150",
                  isSelected
                    ? "border-alert/60 bg-alert/10 shadow-[0_0_24px_-8px_rgba(255,84,112,0.5)]"
                    : "border-line bg-abyss-950/50 hover:border-mist/50",
                )}
              >
                <UserCheck
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 transition-colors",
                    isSelected ? "text-alert" : "text-dim group-hover:text-mist",
                  )}
                />
                <span className="min-w-0">
                  <span className="block font-display text-sm font-semibold tracking-wide text-ink">
                    {suspect.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase leading-snug tracking-[0.1em] text-dim sm:tracking-[0.18em]">
                    {suspect.role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {state.message && state.status === "error" ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 border border-alert/40 bg-alert/10 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="flex flex-wrap items-center gap-4 border-t border-line/60 pt-4">
          <input type="hidden" name="suspectCode" value={selected ?? ""} />
          <SealButton disabled={!selected} />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            This cannot be undone
          </p>
        </form>
      </div>
    </Panel>
  );
}
