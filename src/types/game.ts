/**
 * Game-domain types that are safe to share with client components.
 * These carry NO answers, NO hint payloads beyond those already claimed,
 * and NO scoring secrets — only what the browser needs to render state.
 */

export type RoundCode = "ROUND_1" | "ROUND_2";

export type RoundStatus = "PENDING" | "ACTIVE" | "ENDED";

export type PuzzleKind = "DIGITAL" | "PHYSICAL_CHECKPOINT" | "FINAL_CODE";

export type PuzzleStatus = "LOCKED" | "UNLOCKED" | "SOLVED";

/* -------------------------------------------------------------------------- */
/* Server-computed views (all timestamps ISO-8601 strings)                     */
/* -------------------------------------------------------------------------- */

export interface RoundInfo {
  code: RoundCode;
  status: RoundStatus;
  startedAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  /** Server clock at render time — clients sync their countdown to this. */
  serverTime: string;
  /** null when the round has not started. */
  remainingSeconds: number | null;
}

export interface PuzzleSnapshot {
  code: string;
  orderIndex: number;
  kind: PuzzleKind;
  title: string;
  /** null while the puzzle is LOCKED — briefings never leak early. */
  briefing: string | null;
  points: number;
  status: PuzzleStatus;
  isCurrent: boolean;
  wrongAttempts: number;
  penaltyPoints: number;
  lockedUntil: string | null;
  solvedAt: string | null;
  hintsAvailable: number;
  /** Only hints actually claimed by this team. */
  usedHints: string[];
  /**
   * How the answer box presents itself. Always present — every puzzle has an
   * input, so the component never has to branch on null.
   */
  answerInput: AnswerInputView;
  /** The team's submitted answer for this puzzle, if solved. Null if unsolved. */
  submittedAnswer?: string | null;
  /**
   * Newspaper group data. When present, this puzzle is part of a multi-answer
   * group presented as a single question. The UI renders multiple answer fields.
   */
  newspaperGroup?: {
    /** Puzzle code submitted as the server action's group anchor. */
    anchorCode: string;
    /** All puzzle codes in the group, in display order. */
    codes: string[];
    /** Generic prompt shown instead of individual briefings. */
    prompt: string;
    /** Per-field labels. */
    fieldLabels: string[];
    /** How many answers in the group have been solved by this team. */
    solvedCount: number;
    /** Total answers in the group. */
    totalCount: number;
    /** The team's submitted answers for each field (null if not yet solved). */
    submittedAnswers: (string | null)[];
  };
}

/**
 * Presentation for the answer box. Carries no answer: the placeholder is a
 * shape hint the puzzle author chose, and the limits exist so a team cannot
 * fat-finger a longer string than the door accepts.
 */
export interface AnswerInputView {
  placeholder: string;
  maxLength: number;
  /** Restrict to A–Z; the browser refuses digits and punctuation outright. */
  lettersOnly: boolean;
}

export interface SuspectOption {
  code: string;
  name: string;
  role: string;
}

export interface VoteSnapshot {
  unlocked: boolean;
  submitted: boolean;
  suspectCode: string | null;
  suspects: SuspectOption[];
}

export interface RoundSnapshot {
  teamName: string;
  round: RoundInfo;
  score: number;
  solvedCount: number;
  totalCount: number;
  puzzles: PuzzleSnapshot[];
  currentPuzzleCode: string | null;
  finished: boolean;
  finishedAt: string | null;
  finalRank: number | null;
  qualified: boolean | null;
  vote?: VoteSnapshot;
}

export type TeamSnapshotResult =
  | { kind: "uninitialized" }
  | { kind: "pending"; round: RoundInfo }
  | {
      kind: "gated";
      round: RoundInfo;
      reason: "AWAITING_QUALIFICATION" | "NOT_QUALIFIED";
    }
  | { kind: "ready"; snapshot: RoundSnapshot };

/* -------------------------------------------------------------------------- */
/* Leaderboards (public-safe)                                                  */
/* -------------------------------------------------------------------------- */

export interface LeaderboardRow {
  rank: number;
  teamId: number;
  name: string;
  score: number;
  solvedCount: number;
  finishedAt: string | null;
  qualified: boolean | null;
  voted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Action states for client forms                                              */
/* -------------------------------------------------------------------------- */

export interface SubmitActionState {
  status: "idle" | "correct" | "wrong" | "blocked";
  message?: string;
  lockoutUntil?: string | null;
}

export const initialSubmitState: SubmitActionState = { status: "idle" };

export interface VoteActionState {
  status: "idle" | "sealed" | "error";
  message?: string;
}

export const initialVoteState: VoteActionState = { status: "idle" };

export interface MultiAnswerActionState {
  status: "idle" | "correct" | "partial" | "wrong" | "blocked";
  message?: string;
  lockoutUntil?: string | null;
  correctCount?: number;
}

export const initialMultiAnswerState: MultiAnswerActionState = { status: "idle" };
