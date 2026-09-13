"use server";

import { revalidatePath } from "next/cache";
import { requireTeam } from "@/lib/auth/guards";
import { castVote, claimHint, submitAnswer } from "@/server/game/engine";
import type { SubmitActionState, VoteActionState } from "@/types/game";
import type { RoundCode } from "@/types/game";

function roundPath(roundCode: RoundCode): string {
  return roundCode === "ROUND_1" ? "/team/round-1" : "/team/round-2";
}

function parseRoundCode(value: FormDataEntryValue | null): RoundCode | null {
  return value === "ROUND_1" || value === "ROUND_2" ? value : null;
}

export async function submitAnswerAction(
  _previous: SubmitActionState,
  formData: FormData,
): Promise<SubmitActionState> {
  const { team } = await requireTeam();

  const roundCode = parseRoundCode(formData.get("roundCode"));
  const puzzleCode = String(formData.get("puzzleCode") ?? "").trim();
  const answer = String(formData.get("answer") ?? "");

  if (!roundCode || !puzzleCode || puzzleCode.length > 16) {
    return { status: "blocked", message: "Malformed submission." };
  }
  if (answer.length === 0 || answer.length > 255) {
    return { status: "blocked", message: "Provide an answer (max 255 characters)." };
  }

  const result = await submitAnswer({
    teamId: team.id,
    roundCode,
    puzzleCode,
    rawAnswer: answer,
  });

  revalidatePath(roundPath(roundCode));
  revalidatePath("/lobby");

  switch (result.outcome) {
    case "CORRECT":
      return { status: "correct", message: result.message };
    case "WRONG":
      return {
        status: "wrong",
        message: result.message,
        lockoutUntil: result.lockoutUntil?.toISOString() ?? null,
      };
    default:
      return {
        status: "blocked",
        message: result.message,
        lockoutUntil: result.lockoutUntil?.toISOString() ?? null,
      };
  }
}

export interface HintActionResult {
  ok: boolean;
  hint?: string;
  error?: string;
}

/** Claim the next hint for a puzzle. Returns the hint payload on success. */
export async function requestHintAction(
  roundCode: RoundCode,
  puzzleCode: string,
): Promise<HintActionResult> {
  const { team } = await requireTeam();

  if (roundCode !== "ROUND_1" && roundCode !== "ROUND_2") {
    return { ok: false, error: "Malformed request." };
  }
  if (!puzzleCode || puzzleCode.length > 16) {
    return { ok: false, error: "Malformed request." };
  }

  const result = await claimHint({ teamId: team.id, roundCode, puzzleCode });
  revalidatePath(roundPath(roundCode));
  return result;
}

export async function castVoteAction(
  _previous: VoteActionState,
  formData: FormData,
): Promise<VoteActionState> {
  const { team } = await requireTeam();

  const suspectCode = String(formData.get("suspectCode") ?? "").trim();
  if (!suspectCode || suspectCode.length > 80) {
    return { status: "error", message: "Select a suspect before sealing." };
  }

  const result = await castVote({ teamId: team.id, suspectCode });

  revalidatePath("/team/round-2");

  switch (result.outcome) {
    case "SEALED":
    case "DUPLICATE":
      return { status: "sealed", message: result.message };
    default:
      return { status: "error", message: result.message };
  }
}

