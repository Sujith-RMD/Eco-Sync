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
 */

export interface PuzzleSeed {
  code: string;
  orderIndex: number;
  kind: "DIGITAL" | "PHYSICAL_CHECKPOINT" | "FINAL_CODE";
  title: string;
  briefing: string;
  answer: string;
  hints: string[];
  points: number;
}

/* -------------------------------------------------------------------------- */
/* ROUND 1 — 7 sequential puzzles (P1→P7), 40 minutes                          */
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
    points: 100,
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
    points: 100,
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
    points: 100,
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
    points: 100,
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
    points: 100,
  },
  {
    code: "P7",
    orderIndex: 7,
    kind: "DIGITAL",
    title: "THE CASE CODE",
    briefing:
      "Build the case code. Each tag is Puzzle number, then letter position.\n" +
      "6-3 · 5-2 · 3-5 · 1-2 · 1-5 · 1-6 · 6-5",
    answer: "TRAITOR",
    hints: [
      "Take each letter from the answer you already submitted for that puzzle, counting from the first character. Seven letters.",
    ],
    points: 150,
  },
];

/* -------------------------------------------------------------------------- */
/* ROUND 2 — supplied questions only, in play order:                            */
/* S1 → S3 → S4 → S5 → S6 → S7 → S8 → LAST → vote                              */
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
 * RUNBOOK — S7's answer is a sentinel, not a solution: the two QR payloads were
 * not supplied. Round 2 must not be opened until it is armed, because LAST sits
 * directly behind it.
 */
export const UNARMED_SENTINEL = "__UNARMED__";

export const ROUND2_PUZZLES: PuzzleSeed[] = [
  {
    code: "S1",
    orderIndex: 1,
    kind: "DIGITAL",
    title: "The Crumpled Draft",
    briefing:
      "The culprit threw away a draft somewhere in this room.\n" +
      "What did they do to the figures?",
    answer: "FUDGED",
    hints: [],
    points: 100,
  },
  {
    code: "S3",
    orderIndex: 2,
    kind: "DIGITAL",
    title: "The Judging Schedule",
    briefing: "When did Rohan's presentation begin? (HHMM, no colon)",
    answer: "0215",
    hints: [],
    points: 100,
  },
  {
    code: "S4",
    orderIndex: 3,
    kind: "DIGITAL",
    title: "Newspaper — Crossword",
    briefing:
      "Solve the crossword on page 4.\n" +
      "Take the first letter of each answer, in hint order.\n" +
      "What was the real crime?",
    answer: "MISREPORTING",
    hints: [],
    points: 100,
  },
  {
    code: "S5",
    orderIndex: 4,
    kind: "DIGITAL",
    title: "Newspaper — Highlighted Letters",
    briefing:
      "The highlighted letters on page 2 reveal a hidden word.\n" +
      "What is the word?",
    answer: "INTERDEPENDENCE",
    hints: [],
    points: 100,
  },
  {
    code: "S6",
    orderIndex: 5,
    kind: "DIGITAL",
    title: "Newspaper — Fill in the Blanks",
    briefing:
      "Fill in the blanks in the paragraph on page 2.\n" +
      "What word is revealed?",
    answer: "MISUNDERSTOOD",
    hints: [],
    points: 100,
  },
  {
    code: "S7",
    orderIndex: 6,
    kind: "DIGITAL",
    title: "Newspaper — Hidden QR Codes",
    briefing:
      "The words “waste” and “podium” point to two QR codes hidden in the room.\n" +
      "Find and scan both QR codes.\n" +
      "What do they reveal?",
    // Supplied material does not state the solution. Arm via the runbook.
    answer: UNARMED_SENTINEL,
    hints: [],
    points: 100,
  },
  {
    code: "S8",
    orderIndex: 7,
    kind: "DIGITAL",
    title: "The Gate Log",
    briefing:
      "One suspect's car is in the gate log, and their statement says they were home all night.\n" +
      "When did that car enter campus? (HHMM, no colon)",
    answer: "0158",
    hints: [],
    points: 100,
  },
  {
    code: FINAL_CODE_PUZZLE_CODE,
    orderIndex: 8,
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
/* Culprit vote (supplied material)                                            */
/* -------------------------------------------------------------------------- */

export interface SuspectEntry {
  code: string;
  name: string;
  role: string;
}

export const SUSPECTS: SuspectEntry[] = [
  { code: "VIKRAM_SHETTY", name: "VIKRAM SHETTY", role: "Facilities contractor" },
  { code: "ROHAN_MEHTA", name: "ROHAN MEHTA", role: "Presenter — 02:15 slot" },
  { code: "ANANYA_IYER", name: "ANANYA IYER", role: "Library archivist" },
  { code: "ARJUN_PILLAI", name: "ARJUN PILLAI", role: "AV & projector operator" },
  { code: "MEERA_KULKARNI", name: "MEERA KULKARNI", role: "ECO-SYNC data analyst" },
  { code: "KABIR_MALHOTRA", name: "KABIR MALHOTRA", role: "Night security lead" },
];

/** [SERVER-ONLY] The culprit identified by the supplied game material. */
export const CORRECT_SUSPECT_CODE = "VIKRAM_SHETTY";

/** Validate a suspect code without revealing the correct one. */
export function isKnownSuspect(code: string): boolean {
  return SUSPECTS.some((suspect) => suspect.code === code);
}
