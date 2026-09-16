"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  ShieldQuestion,
  Square,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  endRoundAction,
  extendRoundTimeAction,
  purgeEventAction,
  qualifyTop15Action,
  restartEventAction,
  seedEventAction,
  startRoundAction,
} from "@/server/admin/actions";
import {
  initialAdminActionState,
  initialSeedActionState,
  type AdminActionState,
  type SeedActionState,
} from "@/types/admin";
import type { RoundCode, RoundStatus } from "@/types/game";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

function ActionMessage({ state }: { state: AdminActionState | SeedActionState }) {
  if (!state.message) return null;
  const ok = state.status === "ok";
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 border px-3.5 py-3 font-mono text-[12px] leading-relaxed ${
        ok
          ? "border-acid/40 bg-acid/10 text-acid"
          : "border-alert/40 bg-alert/10 text-alert"
      }`}
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
 * Submit button as its own component, because `useFormStatus` only reports on a
 * form when it is called from a component *inside* that form. The seven controls
 * below used to call it in the component that renders the `<form>` itself,
 * where it reads no ancestor context and `pending` is permanently false — the
 * buttons never disabled and never spun, so an operator could double-tap
 * RESTART or PURGE while the first request was still in flight. Same fix as
 * `team-repair.tsx`'s `RepairSubmit`.
 */
function SubmitButton({
  children,
  idle,
  variant,
}: {
  children: React.ReactNode;
  idle: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : idle}
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */

function StartRoundForm({ code, label }: { code: RoundCode; label: string }) {
  const [state, formAction] = useActionState(startRoundAction, initialAdminActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="roundCode" value={code} />
      <TextInput
        name="confirm"
        required
        placeholder="Type CONFIRM"
        autoComplete="off"
        className="uppercase"
      />
      <SubmitButton idle={<Play className="h-3.5 w-3.5" />}>Start {label}</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

function EndRoundForm({ code, label }: { code: RoundCode; label: string }) {
  const [state, formAction] = useActionState(endRoundAction, initialAdminActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="roundCode" value={code} />
      <TextInput
        name="confirm"
        required
        placeholder="Type CONFIRM"
        autoComplete="off"
        className="uppercase"
      />
      <SubmitButton idle={<Square className="h-3.5 w-3.5" />} variant="danger">
        End {label}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

function ExtendRoundForm({ code, label }: { code: RoundCode; label: string }) {
  const [state, formAction] = useActionState(extendRoundTimeAction, initialAdminActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="roundCode" value={code} />
      <TextInput
        name="extraMinutes"
        required
        type="number"
        min={1}
        max={60}
        placeholder="Minutes to add"
        autoComplete="off"
      />
      <SubmitButton idle={<Clock className="h-3.5 w-3.5" />}>Extend {label}</SubmitButton>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
        1–60 minutes. Adds time from now (or from the current end time if it hasn&apos;t expired yet).
      </p>
      <ActionMessage state={state} />
    </form>
  );
}

function RoundControlCard({
  code,
  label,
  status,
  meta,
  endsAt,
}: {
  code: RoundCode;
  label: string;
  status: RoundStatus | undefined;
  meta: string;
  endsAt?: Date | null;
}) {
  const endsAtLabel = endsAt
    ? `ends ${endsAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}`
    : null;

  return (
    <Panel
      title={label}
      aside={
        <StatusPill
          tone={status === "ACTIVE" ? "ok" : status === "PENDING" ? "warn" : "muted"}
          label={status ?? "offline"}
          staticDot={status !== "ACTIVE"}
        />
      }
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
        {meta}
      </p>
      {endsAtLabel && status === "ACTIVE" ? (
        <p className="mb-4 font-mono text-[11px] text-acid">
          {endsAtLabel}
        </p>
      ) : null}
      {status === "PENDING" ? <StartRoundForm code={code} label={label} /> : null}
      {status === "ACTIVE" ? (
        <div className="space-y-4">
          <ExtendRoundForm code={code} label={label} />
          <div className="border-t border-line/60 pt-3">
            <EndRoundForm code={code} label={label} />
          </div>
        </div>
      ) : null}
      {status === "ENDED" ? (
        <p className="font-mono text-[12px] text-dim">
          Round concluded. The ledger is closed.
        </p>
      ) : null}
      {status === undefined ? (
        <p className="font-mono text-[12px] text-dim">
          Not initialized — seed the event below.
        </p>
      ) : null}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

function QualifyForm() {
  const [state, formAction] = useActionState(qualifyTop15Action, initialAdminActionState);
  return (
    <form action={formAction} className="space-y-3">
      <TextInput
        name="confirm"
        required
        placeholder="Type CONFIRM"
        autoComplete="off"
        className="uppercase"
      />
      <SubmitButton idle={<Trophy className="h-3.5 w-3.5" />}>Qualify top 15</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

function PurgeForm() {
  const [state, formAction] = useActionState(purgeEventAction, initialAdminActionState);
  return (
    <form action={formAction} className="space-y-3">
      <TextInput
        name="confirm"
        required
        placeholder="Type PURGE"
        autoComplete="off"
        className="uppercase"
      />
      <SubmitButton idle={<Trash2 className="h-3.5 w-3.5" />} variant="danger">
        Purge everything
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

/**
 * RESTART is the everyday "run this event again" control. PURGE is still
 * reachable, but only inside a collapsed disclosure — it also destroys the 61
 * access codes the room is currently holding.
 */
function RestartForm() {
  const [state, formAction] = useActionState(restartEventAction, initialAdminActionState);
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] leading-relaxed text-mist">
        <span className="text-caution">Wipes all play data</span> — scores,
        answers, hints, verdicts and qualifications — and puts Round 01 and
        Round 02 back to PENDING.
      </p>
      <p className="font-mono text-[11px] leading-relaxed text-dim">
        <span className="text-acid">Kept</span>: every team and the access codes
        already handed out, the puzzle chain, operators and the audit trail.
        Teams sign in again with the same code and get a clean board.
      </p>

      <form action={formAction} className="space-y-3">
        <TextInput
          name="confirm"
          required
          placeholder="Type RESTART"
          autoComplete="off"
          className="uppercase"
        />
        <SubmitButton idle={<RotateCcw className="h-3.5 w-3.5" />} variant="danger">
          Restart event — wipe and replay
        </SubmitButton>
        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-dim sm:tracking-[0.18em]">
          Guarded: refused while a round is live — end it first. Also releases
          any team paused for too many wrong codes.
        </p>
        <ActionMessage state={state} />
      </form>

      <details className="border-t border-line/60 pt-3">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-dim transition-colors hover:text-alert sm:tracking-[0.2em]">
          Full purge — also deletes teams and access codes
        </summary>
        <p className="mb-3 mt-2 font-mono text-[11px] leading-relaxed text-dim">
          Only for building a brand-new event. This destroys the rounds, the
          puzzle chain and every access code, so the slips in the room stop
          working and you must re-seed and re-print.
        </p>
        <PurgeForm />
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SeedForm() {
  const [state, formAction] = useActionState(seedEventAction, initialSeedActionState);
  const [copied, setCopied] = useState(false);

  const credentialList = state.result?.teams ?? [];
  const csv = ["team_id,access_code", ...credentialList.map((t) => `${t.name},${t.accessCode}`)].join("\n");

  return (
    <div className="space-y-4">
      {!state.result ? (
        <form action={formAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              name="adminUsername"
              required
              placeholder="Operator ID (e.g. command)"
              autoComplete="off"
              minLength={3}
              maxLength={40}
            />
            <TextInput
              name="adminPassword"
              required
              type="password"
              placeholder="Operator passphrase (10+ chars)"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
            />
          </div>
          <TextInput
            name="seedToken"
            placeholder="First-run seed token (this deployment's FIRST_RUN_SEED_TOKEN)"
            autoComplete="off"
            maxLength={128}
          />
          <TextInput
            name="confirm"
            required
            placeholder="Type CONFIRM"
            autoComplete="off"
            className="uppercase"
          />
          <SubmitButton idle={<ShieldQuestion className="h-3.5 w-3.5" />}>
            Seed event data
          </SubmitButton>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[12px] leading-relaxed text-acid">
            Credentials generated once — copy and distribute now. Access codes
            are stored only as hashes and cannot be recovered later.
          </p>
          <div className="max-h-72 overflow-y-auto border border-line/70">
            <table className="w-full font-mono text-[11px]">
              <thead className="sticky top-0 bg-abyss-900">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-dim">
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Access code</th>
                </tr>
              </thead>
              <tbody>
                {credentialList.map((team) => (
                  <tr key={team.name} className="border-t border-line/40">
                    <td className="px-3 py-1.5 text-ink">{team.name}</td>
                    <td className="px-3 py-1.5 tabular-nums text-acid">{team.accessCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(csv).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            {copied ? "Copied CSV" : "Copy as CSV"}
          </Button>
          <p className="font-mono text-[11px] text-dim">
            Operator: {state.result?.adminUsername}
          </p>
        </div>
      )}
      <ActionMessage state={state} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function AdminControls({
  seeded,
  rounds,
}: {
  seeded: boolean;
  rounds: Array<{ code: RoundCode; status: RoundStatus; endsAt: Date | null }>;
}) {
  const roundMeta = (code: RoundCode) => rounds.find((r) => r.code === code);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <RoundControlCard
          code="ROUND_1"
          label="Round 01"
          status={roundMeta("ROUND_1")?.status}
          endsAt={roundMeta("ROUND_1")?.endsAt}
          meta={`${GAME_CONSTANTS.round1.durationMinutes}:00 window · ${GAME_CONSTANTS.round1.puzzleCount} links · top ${GAME_CONSTANTS.round1.qualifyingTeams} advance`}
        />
        <RoundControlCard
          code="ROUND_2"
          label="Round 02"
          status={roundMeta("ROUND_2")?.status}
          endsAt={roundMeta("ROUND_2")?.endsAt}
          meta={`${GAME_CONSTANTS.round2.durationMinutes}:00 window · ${GAME_CONSTANTS.round2.puzzleCount} links · vote unseals at the end`}
        />
        <Panel title="Qualification">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            Rank Round 01 · mark top 15 · rebuild Round 02 roster. Idempotent.
          </p>
          <QualifyForm />
        </Panel>
      </div>

      <div className={`grid gap-4 ${seeded ? "" : "lg:grid-cols-2"}`}>
        {seeded ? (
          <Panel title="Danger zone">
            <RestartForm />
          </Panel>
        ) : (
          <>
            <Panel title="Initialize event">
              <SeedForm />
            </Panel>
            <Panel title="Danger zone">
              <RestartForm />
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
