import "server-only";

import type { AnswerInputView } from "@/types/game";
import {
  NEWSPAPER_GROUP,
  type MultiAnswerGroupConfig,
} from "@/lib/game/newspaper-group";

/**
 * [SERVER-ONLY — CONFIDENTIAL]
 *
 * Official puzzle catalogue for ECO-SYNC: THE BREACH, built from the supplied
 * Round 1 / Round 2 documents (the source of truth).
 *
 * This module contains ANSWERS and HINT payloads. It must NEVER be imported
 * by client components, route code that serializes into client props, or any
 * public API. The game engine reads it at seed time and answers live only in
 * the database's [SERVER-ONLY] columns afterwards.
 *
 * The `server-only` import above is what turns that from a convention into a
 * build failure: a client component that reaches this module, directly or
 * transitively, no longer compiles instead of shipping the answers to the
 * browser. It is also why `UNARMED_SENTINEL` is declared in `./unarmed` rather
 * than here — that module is deliberately guard-free so the content rule stays
 * unit-testable, and importing this one would drag the guard in behind it.
 */

export type PuzzleDifficulty = "easy" | "medium" | "hard";

export interface PuzzleSeed {
  code: string;
  orderIndex: number;
  kind: "DIGITAL" | "PHYSICAL_CHECKPOINT" | "FINAL_CODE";
  title: string;
  briefing: string;
  answer: string;
  hints: string[];
  points: number;
  difficulty?: PuzzleDifficulty;
  /**
   * Presentation for the answer box. Never affects grading — `answer` is what
   * the engine compares, and these three only shape the input a team types
   * into.
   *
   * They live here rather than in a database column because they are not game
   * content: a placeholder is a hint about the answer's SHAPE, and the author
   * sets it beside the answer it describes. Keeping them out of the schema
   * means changing one is a redeploy, not a migration on every environment.
   */
  answerPlaceholder?: string;
  answerMaxLength?: number;
  answerLettersOnly?: boolean;
}

/* -------------------------------------------------------------------------- */
/* ROUND 1 — 10 sequential puzzles (P1→P10), 45 minutes                        */
/* -------------------------------------------------------------------------- */

export const ROUND1_PUZZLES: PuzzleSeed[] = [
  {
    code: "P1",
    orderIndex: 1,
    kind: "DIGITAL",
    title: "COLD BOOT",
    briefing:
      "SYSTEM OFFLINE. BREACH DETECTED AT 02:17\n" +
      "Last message recovered: SXDBENOB KVSKC XSQRDYGV\n" +
      "Add the digits of the time. Then step back.",
    answer: "NIGHTOWL",
    hints: [
      "The digits of 02:17 add up to a number. Move each letter back that many places in the alphabet. Enter one word, no spaces.",
    ],
    points: 100,
    difficulty: "medium",
    answerPlaceholder: "ENTER ONE WORD",
  },
  {
    code: "P2",
    orderIndex: 2,
    kind: "DIGITAL",
    title: "BADGE LOG",
    briefing:
      "Badge | Entry | Exit\n" +
      "1107 | 01:50 | 02:15\n" +
      "2291 | 02:10 | 02:45\n" +
      "3048 | 02:05 | 02:30\n" +
      "4415 | 01:30 | 02:16\n" +
      "\n" +
      "Security note: the entry scanner's clock runs 10 minutes slow. Which badge was inside at 2:17 AM?",
    answer: "3048",
    hints: [
      "Only the entry scanner is wrong. Push every ENTRY time forward by 10 minutes and leave the exit times as printed. Enter the four digits.",
    ],
    points: 75,
    difficulty: "easy",
  },
  {
    code: "P3",
    orderIndex: 3,
    kind: "DIGITAL",
    title: "FOUR FRAGMENTS",
    briefing: "The breach signal left 4 fragments in this room. Find them.",
    answer: "LIBRARY",
    hints: [
      "All four fragments are inside your own room, never in the corridor. Join them in the order they are numbered and enter one word.",
    ],
    points: 75,
    difficulty: "easy",
    answerPlaceholder: "ASKEY YOUR COMPUTER",
  },
  {
    code: "P4",
    orderIndex: 4,
    kind: "DIGITAL",
    title: "THE MARK",
    briefing:
      "The intruder left a mark on the machine in your room. What did they plug into the terminal?",
    answer: "USB",
    hints: ["Three letters. Name the kind of device, not a brand."],
    points: 75,
    difficulty: "easy",
    answerPlaceholder: "ABC",
    answerMaxLength: 3,
    answerLettersOnly: true,
  },
  {
    code: "P5",
    orderIndex: 5,
    kind: "DIGITAL",
    title: "ONE KEY TOO FAR",
    briefing:
      "The keylogger caught the file name, but the intruder typed in the dark, one key too far right. Check the door.",
    answer: "GREENWASH",
    hints: [
      "Read what is on the door, then move one key to the LEFT on a QWERTY keyboard for every character. One word.",
    ],
    points: 125,
    difficulty: "hard",
  },
  {
    code: "P6",
    orderIndex: 6,
    kind: "DIGITAL",
    title: "ON THE GLASS",
    briefing: "The first data they touched is written backwards on the glass.",
    answer: "WATER",
    hints: [
      "Copy the word off the glass exactly as it appears, then read your copy from the other end. Five letters.",
    ],
    points: 75,
    difficulty: "easy",
  },
  {
    code: "P7",
    orderIndex: 7,
    kind: "DIGITAL",
    title: "RECOVERED TRANSMISSION",
    briefing:
      "The signal appears to have been transmitted backwards.\n" +
      "\n" +
      "Nothing is missing. Nothing is encrypted.\n" +
      "\n" +
      "Reverse the transmission and uncover where the signal was meant to lead.\n" +
      "\n" +
      "33=xedni&nDaXbcZKzsGVksDs01yRDlP_wPmIPL1NLP=tsil&AnDXWiP971t=v?\n" +
      "\n" +
      "What is the destination?",
    answer: "RICKROLL",
    answerPlaceholder: "ENTER 8 LETTERS",
    hints: [
      "Reverse the string in the briefing. It reads as a YouTube URL — the video name is the answer.",
    ],
    points: 100,
    difficulty: "medium",
  },
{
    code: "P8",
    orderIndex: 8,
    kind: "DIGITAL",
    title: "PACKET CAPTURE",
    briefing:
      "Decode the payload and recover the hidden message.\n" +
      "\n" +
      "[IMG:puzzles/packet-capture.png]",
    answer: "RESOURCE",
    hints: [
      "Every pair of hex digits is one character. 52 is R and 45 is E — read all eight pairs the same way.",
    ],
    points: 125,
    difficulty: "hard",
  },
  {
    code: "P9",
    orderIndex: 9,
    kind: "DIGITAL",
    title: "SYSTEM LOG",
    briefing:
      "The logs show a chain of failures escalating from connection to access, ending with a lost connection.\n" +
      "Which subsystem is at the heart of the failure?\n" +
      "\n" +
      "[IMG:puzzles/system-log.png]",
    answer: "DATABASE",
    hints: [
      "Every failing row names the same system in the first column, and the water, power and food rows around them stay NORMAL.",
    ],
    points: 75,
    difficulty: "easy",
  },
{
    code: "P10",
    orderIndex: 10,
    kind: "DIGITAL",
    title: "THE CASE CODE",
    briefing:
      "Build the case code. Each tag is Puzzle number, then letter position.\n" +
      "6-3 · 5-2 · 5-7 · 1-2 · 1-5 · 1-6 · 6-5",
    answer: "TRAITOR",
    hints: [
      "Take each letter from the answer you already submitted for that puzzle, counting from the first character. Seven letters.",
    ],
    points: 150,
    difficulty: "hard",
  },
];

/* -------------------------------------------------------------------------- */
/* ROUND 2 — supplied questions only, in play order:                          */
/* S1 → S2 → S3 → S4 → S5 → S6 → LAST → vote                                  */
/* -------------------------------------------------------------------------- */

/**
 * The closing puzzle's code. The engine resolves the culprit-vote unlock through
 * this constant (`engine.ts`), so the value must match the seeded row exactly.
 */
export const FINAL_CODE_PUZZLE_CODE = "LAST";

/**
 * Round 2 is authored from the supplied documents. `orderIndex` must stay
 * contiguous from 1: `submitAnswer` unlocks `orderIndex + 1` by exact match, so
 * a gap silently strands every later puzzle and an unset answer can block the
 * culprit vote.
 *
 * The QR pair and newspaper answers are represented as hidden multi-answer rows.
 * Database, this catalogue, and the content verification SQL must agree, or a
 * drift re-seals the chain for every room behind the affected link.
 */
export const ROUND2_PUZZLES: PuzzleSeed[] = [
  {
    code: "S1",
    orderIndex: 1,
    kind: "DIGITAL",
    title: "THE AUDIT NOTE",
    briefing:
      "Figures for this quarter are looking excellent.\n" +
      "Usage of water is down almost 30 percent.\n" +
      "Don't worry about the audit, it's routine.\n" +
      "Green Campus rating should be ours this year.\n" +
      "Everything in ECO-SYNC is under control.\n" +
      "Destroy this note after reading.\n\n" +
      "What is hidden in the note?",
    answer: "FUDGED",
    hints: [
      "Look closely at how each line begins. The first letters reveal the answer.",
    ],
    points: 100,
    answerPlaceholder: "ENTER ONE WORD",
  },
  {
    code: "S2",
    orderIndex: 2,
    kind: "DIGITAL",
    title: "THE FOUR WALLS",
    briefing:
      "Four physical sheets were recovered from the investigation room. Together, they form a cipher key.\n" +
      "Use the four sheets to decode the recovered transmission and reverse it.",
    answer: "SUSTAINABILITY",
    hints: [
      "Use the four physical sheets as the cipher key, then decode the transmission. Once decoded, read the recovered text from the other end.",
    ],
    points: 100,
    answerPlaceholder: "ENTER ONE WORD",
  },
  {
    code: "S3",
    orderIndex: 3,
    kind: "DIGITAL",
    title: "The Judging Schedule",
    briefing:
      "OVERNIGHT HACKATHON: JUDGING ROUND, CS LAB\n\n" +
      "First presentation starts at 1:00 AM.\n\n" +
      "Each team gets 12 minutes, plus 3 minutes to change over.\n\n" +
      "Presenting order: Team Byte, Team Loop, Team Kernel, Team Pixel, Team Stack, Team NightOwl (R. Das), Team Null.\n\n" +
      "When did Rohan's presentation begin? (HHMM, no colon)",
    answer: "0215",
    hints: [],
    points: 100,
  },
  {
    code: "S4",
    orderIndex: 4,
    kind: "DIGITAL",
    title: "Newspaper Evidence",
    briefing:
      "Recover the hidden message from page 4 of the newspaper.",
    answer: "MISREPORTING",
    hints: [],
    points: 100,
  },
  {
    code: "S4a",
    orderIndex: 100,
    kind: "DIGITAL",
    title: "Newspaper Evidence",
    briefing:
      "Recover the hidden message from page 2 of the newspaper.",
    answer: "INTERDEPENDENCE",
    hints: [],
    points: 100,
  },
  {
    code: "S4b",
    orderIndex: 101,
    kind: "DIGITAL",
    title: "Newspaper Evidence",
    briefing:
      "Recover the hidden message from page 2 of the newspaper.",
    answer: "MISUNDERSTOOD",
    hints: [],
    points: 100,
  },
  {
    code: "S5",
    orderIndex: 5,
    kind: "DIGITAL",
    title: "Hidden QR Codes",
    briefing:
      'Two QR codes were found in the room. Scan both and recover the hidden words.',
    answer: "RECYCLING",
    hints: [],
    points: 100,
    answerPlaceholder: "ENTER ONE WORD",
  },
  {
    code: "S5a",
    orderIndex: 110,
    kind: "DIGITAL",
    title: "Hidden QR Codes",
    briefing:
      "Recover the hidden word from the first QR code.",
    answer: "RECYCLING",
    hints: [],
    points: 100,
  },
  {
    code: "S5b",
    orderIndex: 111,
    kind: "DIGITAL",
    title: "Hidden QR Codes",
    briefing:
      "Recover the hidden word from the second QR code.",
    answer: "SEGREGATION",
    hints: [],
    points: 100,
  },
  {
    code: "S6",
    orderIndex: 6,
    kind: "DIGITAL",
    title: "The Gate Log",
    briefing:
      "One suspect's car is in the gate log.\n" +
      "When did that car enter campus?",
    answer: "0158",
    hints: [],
    points: 100,
  },
  {
    code: FINAL_CODE_PUZZLE_CODE,
    orderIndex: 7,
    kind: "FINAL_CODE",
    title: "Outdoor Backup",
    briefing:
      "CASE UPDATE: BACKUP LOCATED\n" +
      "ECO-SYNC kept one last backup of the original data.\n" +
      "\n" +
      "I have a stage but no roof, and my seats face the open sky.\n" +
      "Find the backup there.\n" +
      "Decode it, then return here with the code and the culprit's name.",
    // The name is carried by the culprit vote, which this answer unseals.
    answer: "TRUTH",
    hints: [],
    points: 150,
  },
];

/* -------------------------------------------------------------------------- */
/* Newspaper group — S4, S5, S6 presented as one question                       */
/* -------------------------------------------------------------------------- */

/**
 * Re-export from the shared module for server-side consumers.
 */
export { NEWSPAPER_GROUP } from "@/lib/game/newspaper-group";
export type { MultiAnswerGroupConfig as NewspaperGroup } from "@/lib/game/newspaper-group";

export function isNewspaperGroupMember(code: string): boolean {
  return NEWSPAPER_CODE_SET.has(code);
}

const NEWSPAPER_CODE_SET = new Set(NEWSPAPER_GROUP.codes);

/** Get the newspaper group for a puzzle code, or null if not grouped. */
export function getNewspaperGroup(code: string): MultiAnswerGroupConfig | null {
  return NEWSPAPER_CODE_SET.has(code) || code === NEWSPAPER_GROUP.anchorCode
    ? NEWSPAPER_GROUP
    : null;
}

/* -------------------------------------------------------------------------- */
/* Answer-box presentation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Built once rather than scanned per call. `getTeamRoundSnapshot` runs on every
 * poll, and a linear walk across both rounds for each of the ten links would be
 * pure waste on the hottest path in the game.
 */
const PUZZLE_BY_CODE = new Map<string, PuzzleSeed>(
  [...ROUND1_PUZZLES, ...ROUND2_PUZZLES].map((puzzle) => [puzzle.code, puzzle]),
);

/** Used by every puzzle that declares nothing, which is most of them. */
const DEFAULT_ANSWER_INPUT: AnswerInputView = {
  placeholder: "ENTER ANSWER",
  maxLength: 255,
  lettersOnly: false,
};

/**
 * Resolve the answer box for a puzzle code. Never throws, never returns null:
 * a database row whose code is absent from the catalogue still has to render an
 * input, and a fallback beats a blank box in the middle of a round.
 */
export function answerInputFor(code: string): AnswerInputView {
  const seed = PUZZLE_BY_CODE.get(code);
  if (!seed) return DEFAULT_ANSWER_INPUT;
  return {
    placeholder: seed.answerPlaceholder ?? DEFAULT_ANSWER_INPUT.placeholder,
    maxLength: seed.answerMaxLength ?? DEFAULT_ANSWER_INPUT.maxLength,
    lettersOnly: seed.answerLettersOnly ?? DEFAULT_ANSWER_INPUT.lettersOnly,
  };
}

/* -------------------------------------------------------------------------- */
/* Culprit vote (supplied material)                                            */
/* -------------------------------------------------------------------------- */

export interface SuspectEntry {
  code: string;
  name: string;
  role: string;
}

export const SUSPECTS: SuspectEntry[] = [
  { code: "VIKRAM_SHETTY", name: "VIKRAM SHETTY", role: "Facilities Manager" },
  { code: "MEERA_IYER", name: "MEERA IYER", role: "Internal Auditor" },
  { code: "ROHAN_DAS", name: "ROHAN DAS", role: "Lead Developer, ECO-SYNC" },
  { code: "KAVYA_NAIR", name: "KAVYA NAIR", role: "Library Night Supervisor" },
];

/** [SERVER-ONLY] The culprit identified by the supplied game material. */
export const CORRECT_SUSPECT_CODE = "VIKRAM_SHETTY";

/** Validate a suspect code without revealing the correct one. */
export function isKnownSuspect(code: string): boolean {
  return SUSPECTS.some((suspect) => suspect.code === code);
}
