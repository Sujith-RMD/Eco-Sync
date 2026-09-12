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
/* ROUND 2 — S1 → Envelope A → S2 → Envelope B → S3…S8 → FINAL → vote          */
/* -------------------------------------------------------------------------- */

/** Supplied water-data differences from the open-auditorium installation. */
export const WATER_DATA_DIFFERENCES = [20, 18, 21, 20, 8] as const;

export const FINAL_CODE_PUZZLE_CODE = "FINAL";

export const ROUND2_PUZZLES: PuzzleSeed[] = [
  {
    code: "S1",
    orderIndex: 1,
    kind: "DIGITAL",
    title: "THE DRAFT",
    briefing:
      "PHYSICAL CLUE — the CRUMPLED DRAFT at the recycling station on the round-2 floor. Six lines, hastily balled up and thrown away. Read the first letter of each line, top to bottom. Enter the word they spell.",
    answer: "FUDGED",
    hints: ["Six letters. What was done to the numbers."],
    points: 100,
  },
  {
    code: "ENV_A",
    orderIndex: 2,
    kind: "PHYSICAL_CHECKPOINT",
    title: "ENVELOPE A",
    briefing:
      "PHYSICAL CHECKPOINT — retrieve ENVELOPE A from the evidence locker at the Facilities Office. Inside is a Library ID badge collected on the night of the breach. Enter the badge's ID number to log the evidence.",
    answer: "3048",
    hints: ["You have seen this badge ID before. Four digits."],
    points: 0,
  },
  {
    code: "S2",
    orderIndex: 3,
    kind: "DIGITAL",
    title: "BADGE ORIGIN",
    briefing:
      "Envelope A's Library badge is genuine — the archive confirmed it. Every staff badge is minted by exactly one office. Enter the name of the office that issued badge 3048.",
    answer: "FACILITIES",
    hints: ["The same office that held the envelope. One word."],
    points: 100,
  },
  {
    code: "ENV_B",
    orderIndex: 4,
    kind: "PHYSICAL_CHECKPOINT",
    title: "ENVELOPE B",
    briefing:
      "PHYSICAL CHECKPOINT — retrieve ENVELOPE B from the auditorium podium. Inside is the judging schedule from the final review night. Enter Rohan's presentation start time (HHMM, 24-hour).",
    answer: "0215",
    hints: ["Four digits, leading zero. Early morning."],
    points: 0,
  },
  {
    code: "S3",
    orderIndex: 5,
    kind: "DIGITAL",
    title: "NAME ON THE SLOT",
    briefing:
      "The 02:15 slot on the judging schedule mattered — someone needed that room empty at that exact time. Whose name sits on that slot? Enter the first name.",
    answer: "ROHAN",
    hints: ["The presenter whose start time you logged from Envelope B."],
    points: 100,
  },
  {
    code: "S4",
    orderIndex: 6,
    kind: "DIGITAL",
    title: "WATER DATA — I",
    briefing:
      "PHYSICAL CLUE — the OPEN AUDITORIUM outdoor installation. The original ECO-SYNC water dataset is etched at the base of the stage, next to the published report. Column 1 differs by 20. Decode 20 with A1Z26 (A=1 … Z=26) and enter the letter.",
    answer: "T",
    hints: ["The difference is already a letter position. No math needed."],
    points: 100,
  },
  {
    code: "S5",
    orderIndex: 7,
    kind: "DIGITAL",
    title: "WATER DATA — II",
    briefing:
      "Same installation. Column 2 of the water dataset differs by 18 from the published report. Decode 18 with A1Z26 and enter the letter.",
    answer: "R",
    hints: ["A=1 … Z=26. Count carefully."],
    points: 100,
  },
  {
    code: "S6",
    orderIndex: 8,
    kind: "DIGITAL",
    title: "WATER DATA — III",
    briefing:
      "Same installation. Column 3 differs by 21. Decode 21 with A1Z26 and enter the letter.",
    answer: "U",
    hints: ["A=1 … Z=26. You are past the midpoint of the alphabet."],
    points: 100,
  },
  {
    code: "S7",
    orderIndex: 9,
    kind: "DIGITAL",
    title: "WATER DATA — IV",
    briefing:
      "Same installation. Column 4 differs by 20. Decode 20 with A1Z26 and enter the letter.",
    answer: "T",
    hints: ["A repeat of position one."],
    points: 100,
  },
  {
    code: "S8",
    orderIndex: 10,
    kind: "DIGITAL",
    title: "WATER DATA — V",
    briefing:
      "Same installation. Column 5 differs by 8. Decode 8 with A1Z26 and enter the letter.",
    answer: "H",
    hints: ["Single digits sit at the top of the alphabet."],
    points: 100,
  },
  {
    code: FINAL_CODE_PUZZLE_CODE,
    orderIndex: 11,
    kind: "FINAL_CODE",
    title: "THE VERDICT",
    briefing:
      "You hold five letters recovered from the original water data. Order them and enter the word — the code that closes the breach and unseals the culprit vote.",
    answer: "TRUTH",
    hints: ["What the data was owed from the very start."],
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
