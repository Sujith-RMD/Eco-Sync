"use client";

import { useActionState } from "react";
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

function SealButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="lg" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
      {pending ? "Sealing verdict" : "Seal vote — final"}
    </Button>
  );
}

export function VotePanel({ vote }: { vote: VoteSnapshot }) {
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
              Your team&apos;s verdict is sealed
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
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
          <div className="min-w-0 space-y-3">
            <p className="font-mono text-[12px] leading-relaxed text-mist">
              The culprit vote is sealed. It unseals the moment your team breaks
              the final code on the Answers tab.
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-dim">
              The dossiers above are a reading list, not a ballot — nothing on
              this tab can be selected yet. When the final code breaks, the
              ballot appears here: six names, one vote, irreversible.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Final verdict — culprit vote"
      aside={<StatusPill tone="warn" label="one vote · irreversible" />}
    >
      {/*
        The ballot is native radios inside the form, not buttons driven by
        useState. Selection is the one irreversible act in the game, so it must
        survive a page where the client bundle did not run: this is the only
        control in the app that would otherwise depend on hydration, and a
        hydration miss renders a roster that silently cannot be picked.
      */}
      <form action={formAction} className="space-y-5">
        <p className="font-mono text-[12px] leading-relaxed text-mist">
          Every evidence chain converges on one insider. Select your suspect,
          then seal the verdict. Your team gets exactly one vote — timestamped,
          permanent, and hidden from other teams.
        </p>

        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          role="radiogroup"
          aria-label="Suspect roster"
        >
          {vote.suspects.map((suspect) => (
            <label
              key={suspect.code}
              className={cn(
                "group flex cursor-pointer items-start gap-3 border px-4 py-3.5 text-left transition-all duration-150",
                "border-line bg-abyss-950/50 hover:border-mist/50",
                "has-[:checked]:border-alert/60 has-[:checked]:bg-alert/10",
                "has-[:checked]:shadow-[0_0_24px_-8px_color-mix(in_oklab,var(--color-alert)_50%,transparent)]",
                "has-[:focus-visible]:border-mist has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-mist/40",
              )}
            >
              <input
                type="radio"
                name="suspectCode"
                value={suspect.code}
                required
                className="peer sr-only"
              />
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-dim transition-colors group-hover:text-mist peer-checked:text-alert" />
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold tracking-wide text-ink">
                  {suspect.name}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase leading-snug tracking-[0.1em] text-dim sm:tracking-[0.18em]">
                  {suspect.role}
                </span>
              </span>
            </label>
          ))}
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

        <div className="flex flex-wrap items-center gap-4 border-t border-line/60 pt-4">
          <SealButton />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            This cannot be undone
          </p>
        </div>
      </form>
    </Panel>
  );
}
