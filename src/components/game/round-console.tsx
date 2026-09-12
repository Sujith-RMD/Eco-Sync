"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  MapPin,
  Radio,
  SendHorizontal,
  Trophy,
} from "lucide-react";
import { submitAnswerAction, useHintAction } from "@/server/team/actions";
import {
  initialSubmitState,
  type PuzzleSnapshot,
  type RoundSnapshot,
} from "@/types/game";
import { cn } from "@/lib/utils/cn";
import { toEventClock, toEventStamp } from "@/lib/utils/time";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { AutoRefresh, LockoutBadge, ServerCountdown } from "@/components/game/timer";
import { VotePanel } from "@/components/game/vote-panel";
import { GAME_CONSTANTS } from "@/server/game/constants";

/* -------------------------------------------------------------------------- */
/* Answer submission form (one per selected puzzle, keyed by code)             */
/* -------------------------------------------------------------------------- */

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="sm:w-auto w-full">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
      {pending ? "Transmitting" : "Submit answer"}
    </Button>
  );
}

function AnswerForm({ snapshot, puzzle }: { snapshot: RoundSnapshot; puzzle: PuzzleSnapshot }) {
  const router = useRouter();
  const [state, formAction] = useActionState(submitAnswerAction, initialSubmitState);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const effectiveLockout = state.lockoutUntil ?? puzzle.lockedUntil;
  const roundDead = snapshot.round.remainingSeconds !== null && snapshot.round.remainingSeconds <= 0;
  const roundEnded = snapshot.round.status !== "ACTIVE" || roundDead;
  const locked = lockoutRemaining > 0;

  useEffect(() => {
    if (state.status === "correct") router.refresh();
  }, [state.status, router]);

  return (
    <div className="space-y-4">
      {effectiveLockout ? (
        <LockoutBadge lockedUntil={effectiveLockout} onTick={setLockoutRemaining} />
      ) : null}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="roundCode" value={snapshot.round.code} />
        <input type="hidden" name="puzzleCode" value={puzzle.code} />
        <TextInput
          name="answer"
          required
          maxLength={255}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ENTER ANSWER"
          disabled={roundEnded || locked}
          className="flex-1 uppercase tracking-[0.2em]"
          aria-label={`Answer for puzzle ${puzzle.code}`}
        />
        <SubmitButton disabled={roundEnded || locked} />
      </form>

      {state.message ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 border px-3.5 py-3 font-mono text-[12px] leading-relaxed",
            state.status === "correct" && "border-acid/40 bg-acid/10 text-acid",
            state.status === "wrong" && "border-alert/40 bg-alert/10 text-alert",
            state.status === "blocked" && "border-caution/40 bg-caution/10 text-caution",
          )}
        >
          {state.status === "correct" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {state.message}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hint request (two-step confirm; payload arrives from the server)            */
/* -------------------------------------------------------------------------- */

function HintRequest({ snapshot, puzzle }: { snapshot: RoundSnapshot; puzzle: PuzzleSnapshot }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const noneLeft = puzzle.hintsAvailable <= 0;

  return (
    <div className="space-y-3">
      {puzzle.usedHints.length > 0 ? (
        <ol className="space-y-2">
          {puzzle.usedHints.map((hint, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 border border-caution/30 bg-caution/5 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-caution"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="mr-2 text-caution/60">H{index + 1}</span>
                {hint}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <p className="font-mono text-[12px] text-alert">{error}</p>
      ) : null}

      {confirming && !noneLeft ? (
        <div className="flex flex-wrap items-center gap-3 border border-caution/30 bg-caution/5 px-3.5 py-3">
          <p className="font-mono text-[12px] text-caution">
            Reveal hint? −{GAME_CONSTANTS.scoring.hintPenalty} points, permanently.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await useHintAction(snapshot.round.code, puzzle.code);
                  if (!result.ok) setError(result.error ?? "Hint unavailable.");
                  setConfirming(false);
                  router.refresh();
                });
              }}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm −{GAME_CONSTANTS.scoring.hintPenalty}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Abort
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={noneLeft}
          onClick={() => setConfirming(true)}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {noneLeft ? "No hints remain" : `Request hint −${GAME_CONSTANTS.scoring.hintPenalty}`}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Puzzle detail panel                                                         */
/* -------------------------------------------------------------------------- */

function PuzzleDetail({ snapshot, puzzle }: { snapshot: RoundSnapshot; puzzle: PuzzleSnapshot }) {
  return (
    <Panel
      title={`${puzzle.code} // ${puzzle.title}`}
      aside={
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {puzzle.kind !== "DIGITAL" ? (
            <StatusPill
              tone={puzzle.kind === "FINAL_CODE" ? "warn" : "muted"}
              label={puzzle.kind === "FINAL_CODE" ? "final code" : "checkpoint"}
            />
          ) : null}
          {puzzle.points > 0 ? (
            <StatusPill tone="muted" label={`+${puzzle.points} pts`} staticDot />
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {puzzle.kind === "PHYSICAL_CHECKPOINT" && puzzle.status === "UNLOCKED" ? (
          <div className="flex items-start gap-2.5 border border-pulse/40 bg-pulse/10 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-pulse">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            Physical checkpoint — your unit must interact with a location in the
            venue before entering this code.
          </div>
        ) : null}

        {puzzle.status === "LOCKED" ? (
          <p className="font-mono text-[12px] leading-relaxed text-dim">
            SEALED — this puzzle unseals only when the preceding link in the
            chain is broken. Briefings never transmit early.
          </p>
        ) : (
          <p className="min-w-0 break-words text-sm leading-relaxed text-mist whitespace-pre-line">
            {puzzle.briefing}
          </p>
        )}

        {puzzle.status === "SOLVED" ? (
          <div className="space-y-2 border border-acid/30 bg-acid/5 px-4 py-3.5">
            <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] text-acid">
              <CheckCircle2 className="h-4 w-4" />
              Puzzle solved
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-dim">
              {puzzle.solvedAt
                ? `Logged ${toEventStamp(puzzle.solvedAt)} IST. `
                : ""}
              {puzzle.penaltyPoints > 0
                ? `Wrong-answer penalties on this puzzle: −${puzzle.penaltyPoints}.`
                : "No penalties on this puzzle."}
            </p>
            {puzzle.usedHints.length > 0 ? (
              <ol className="space-y-1 pt-1">
                {puzzle.usedHints.map((hint, index) => (
                  <li key={index} className="font-mono text-[11px] text-caution/90">
                    H{index + 1} · {hint}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {puzzle.status === "UNLOCKED" ? (
          <div className="space-y-6">
            {puzzle.wrongAttempts > 0 ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                Attempts {puzzle.wrongAttempts} · penalty −{puzzle.penaltyPoints}{" "}
                / {GAME_CONSTANTS.scoring.wrongAnswerPenaltyCapPerPuzzle} cap
              </p>
            ) : null}
            <AnswerForm key={puzzle.code} snapshot={snapshot} puzzle={puzzle} />
            <div className="border-t border-line/60 pt-4">
              <HintRequest snapshot={snapshot} puzzle={puzzle} />
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Master console                                                              */
/* -------------------------------------------------------------------------- */

function statusIcon(puzzle: PuzzleSnapshot) {
  if (puzzle.status === "SOLVED") return <CheckCircle2 className="h-4 w-4 text-acid" />;
  if (puzzle.status === "UNLOCKED") return <Radio className="h-4 w-4 text-caution animate-pulse" />;
  return <Lock className="h-4 w-4 text-dim" />;
}

export function RoundConsole({ snapshot }: { snapshot: RoundSnapshot }) {
  const router = useRouter();
  const currentCode = snapshot.currentPuzzleCode ?? snapshot.puzzles.at(-1)?.code ?? "";
  const [selectedCode, setSelectedCode] = useState<string>(currentCode);

  // Follow auto-advance: when the selected puzzle becomes solved, jump to the
  // newly unlocked one.
  useEffect(() => {
    const selected = snapshot.puzzles.find((p) => p.code === selectedCode);
    if (
      selected?.status === "SOLVED" &&
      snapshot.currentPuzzleCode &&
      snapshot.currentPuzzleCode !== selectedCode
    ) {
      setSelectedCode(snapshot.currentPuzzleCode);
    }
    if (!selected && snapshot.puzzles.length > 0) {
      setSelectedCode(snapshot.puzzles.at(-1)!.code);
    }
  }, [snapshot, selectedCode]);

  const selected =
    snapshot.puzzles.find((p) => p.code === selectedCode) ??
    snapshot.puzzles.find((p) => p.isCurrent) ??
    snapshot.puzzles[0];

  const roundEnded = snapshot.round.status === "ENDED";

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={8000} />

      {/* telemetry strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Panel title="Official time">
          <ServerCountdown
            endsAt={snapshot.round.endsAt}
            serverTime={snapshot.round.serverTime}
            className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
          />
        </Panel>
        <Panel title="Score">
          <p className="font-display text-2xl font-bold tabular-nums text-ink sm:text-3xl">
            {snapshot.score}
          </p>
        </Panel>
        <Panel title="Chain">
          <p className="font-display text-2xl font-bold text-ink sm:text-3xl">
            {snapshot.solvedCount}
            <span className="text-dim">/{snapshot.totalCount}</span>
          </p>
        </Panel>
        <Panel title="Status">
          <div className="flex h-full items-center">
            {snapshot.finished ? (
              <StatusPill tone="ok" label="run complete" />
            ) : roundEnded ? (
              <StatusPill tone="muted" label="round ended" staticDot />
            ) : snapshot.currentPuzzleCode ? (
              <StatusPill tone="warn" label={`active // ${snapshot.currentPuzzleCode}`} />
            ) : (
              <StatusPill tone="muted" label="idle" staticDot />
            )}
          </div>
        </Panel>
      </div>

      {/* banners */}
      {snapshot.finished && !roundEnded ? (
        <div className="flex items-start gap-3 border border-acid/40 bg-acid/10 px-4 py-3.5">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-acid" />
          <p className="font-mono text-[12px] leading-relaxed text-acid">
            RUN COMPLETE. Your submission chain is closed and sealed with the
            server clock. Hold position for further directives.
          </p>
        </div>
      ) : null}

      {roundEnded ? (
        <div className="flex items-start gap-3 border border-line bg-abyss-900/60 px-4 py-3.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
          <div className="space-y-1">
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-mist">
              Round ended — submissions closed
            </p>
            {snapshot.round.code === "ROUND_1" ? (
              <p className="font-mono text-[11px] leading-relaxed text-dim">
                {snapshot.finalRank === null
                  ? "Final standings are being computed by command."
                  : `Official rank #${snapshot.finalRank}. ${
                      snapshot.qualified
                        ? "QUALIFIED — Round 02 access granted."
                        : "Not qualified for Round 02."
                    }`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* rail + detail */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="relative border border-line/80 bg-abyss-900/70 backdrop-blur-md">
          <div className="border-b border-line/70 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim sm:tracking-[0.32em]">
              Puzzle chain
            </p>
          </div>
          {/*
            Puzzle selector. This used to be a `flex overflow-x-auto` strip with
            152px chips, so on a phone only ~2 of the 7 (Round 01) or 12 (Round
            02) questions were visible and the rest ran off the edge with no
            hint that it scrolled. Now: a wrapping grid that shows every
            question at once, vertical list from `lg` up.
          */}
          <ol className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:flex lg:flex-col lg:gap-0">
            {snapshot.puzzles.map((puzzle) => {
              const locked = puzzle.status === "LOCKED";
              const isSelected = selected?.code === puzzle.code;
              return (
                <li key={puzzle.code} className="min-w-0 lg:flex-1">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setSelectedCode(puzzle.code)}
                    className={cn(
                      "flex h-full w-full items-start gap-2 px-2.5 py-2.5 text-left transition-colors",
                      "lg:items-center lg:gap-3 lg:px-4 lg:py-3",
                      "border-b border-line/50",
                      locked
                        ? "cursor-not-allowed opacity-45"
                        : "hover:bg-acid/5",
                      isSelected && !locked && "border-l-2 border-l-acid bg-acid/10",
                      puzzle.isCurrent && "bg-caution/5",
                    )}
                  >
                    {statusIcon(puzzle)}
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
                        {puzzle.code}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                        {puzzle.title}
                      </span>
                    </span>
                    {puzzle.kind === "PHYSICAL_CHECKPOINT" ? (
                      <MapPin className="ml-auto h-3.5 w-3.5 shrink-0 text-pulse" />
                    ) : puzzle.kind === "FINAL_CODE" ? (
                      <KeyRound className="ml-auto h-3.5 w-3.5 shrink-0 text-caution" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="min-w-0">
          {selected ? (
            <PuzzleDetail key={selected.code} snapshot={snapshot} puzzle={selected} />
          ) : null}
        </div>
      </div>

      {/* Round 2 final verdict */}
      {snapshot.vote ? <VotePanel vote={snapshot.vote} /> : null}
    </div>
  );
}
