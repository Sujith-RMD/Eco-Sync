"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { unlockPuzzleForTeamAction } from "@/server/admin/actions";
import { initialAdminActionState, type AdminActionState } from "@/types/admin";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import type { RoundCode } from "@/types/game";

export interface RepairLink {
  code: string;
  title: string;
  roundCode: RoundCode;
  orderIndex: number;
}

/**
 * Submit button as its own component, because `useFormStatus` only reports on a
 * form when it is called from a component *inside* that form. Several of the
 * older controls in `admin-controls.tsx` call it in the component that renders
 * the `<form>` itself, where it reads the enclosing context instead — worth a
 * look separately.
 */
function RepairSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <KeyRound className="h-3.5 w-3.5" />
      )}
      {pending ? "Opening" : "Open this link"}
    </Button>
  );
}

function Message({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  const ok = state.status === "ok";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 border px-3.5 py-3 font-mono text-[12px] leading-relaxed",
        ok ? "border-acid/40 bg-acid/10 text-acid" : "border-alert/40 bg-alert/10 text-alert",
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {state.message}
    </div>
  );
}

/**
 * The per-team unstick lever.
 *
 * Round 2's chain unseals `orderIndex + 1` by exact match, so one unpassable
 * link takes a team out of the round entirely — and before this existed the only
 * repairs on the deck were RESTART (all 61 teams) and PURGE (the whole event).
 * A single stuck team used to force an all-or-nothing decision, live.
 *
 * The copy states the limits on the card because an operator reaching for this
 * is under time pressure and should not have to read the source to learn that it
 * awards nothing and retracts nothing.
 */
export function TeamRepairPanel({
  teamId,
  teamName,
  links,
}: {
  teamId: number;
  teamName: string;
  links: RepairLink[];
}) {
  const [state, formAction] = useActionState(
    unlockPuzzleForTeamAction,
    initialAdminActionState,
  );

  const round1 = links.filter((link) => link.roundCode === "ROUND_1");
  const round2 = links.filter((link) => link.roundCode === "ROUND_2");

  return (
    <Panel
      title="Repair — open one link"
      aside={<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">{teamName}</span>}
    >
      <div className="space-y-4">
        <p className="font-mono text-[11px] leading-relaxed text-mist">
          Use this when {teamName} is stuck on a link the room has moved past —
          a missing prop, a briefing read the wrong way. It opens the link so the
          team can carry on.
        </p>

        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-dim sm:tracking-[0.16em]">
          Awards no points · retracts none · leaves wrong-answer penalties ·
          touches no other team
        </p>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="teamId" value={teamId} />

          <Field label="Link to open" htmlFor="puzzleCode">
            <select
              id="puzzleCode"
              name="puzzleCode"
              required
              defaultValue=""
              className={cn(
                // 16px below `sm` for the same iOS auto-zoom reason as TextInput.
                "w-full min-w-0 border border-line bg-abyss-950/80 px-3.5 py-3 font-mono text-base tracking-wide text-ink sm:px-4 sm:text-sm",
                "focus:border-acid/70 focus:outline-none",
              )}
            >
              <option value="" disabled>
                Select a link…
              </option>
              {round1.length > 0 ? (
                <optgroup label="Round 01">
                  {round1.map((link) => (
                    <option key={link.code} value={link.code}>
                      {link.code} · {link.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {round2.length > 0 ? (
                <optgroup label="Round 02">
                  {round2.map((link) => (
                    <option key={link.code} value={link.code}>
                      {link.code} · {link.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>

          <RepairSubmit />
          <Message state={state} />
        </form>
      </div>
    </Panel>
  );
}
