/**
 * Investigation narrative content for the storyline system.
 *
 * Each solved puzzle unlocks a piece of case information that advances the
 * investigation. The narrative answers: "What did this discovery teach the
 * investigators about the case?"
 *
 * Content is derived from the existing ECO-SYNC case material and puzzle
 * answers. No new characters, events, or suspects are invented.
 */

export interface NarrativeEntry {
  /** Puzzle code this narrative unlocks for. */
  puzzleCode: string;
  /** Case note title. */
  title: string;
  /** Timestamp label for the case note. */
  timestamp: string;
  /** The narrative detail — new case information revealed by this discovery. */
  detail: string;
  /** Status tag for the entry. */
  status: "NEW LEAD" | "EVIDENCE" | "CONTRADICTION" | "DISCOVERY" | "CONNECTION" | "CONCLUSION";
}

/**
 * Round 1 narrative — the initial breach investigation.
 * Each entry reveals what the team's discovery means for the case.
 */
export const ROUND1_NARRATIVE: Record<string, NarrativeEntry> = {
  P1: {
    puzzleCode: "P1",
    title: "CASE NOTE // 01",
    timestamp: "02:17 IST",
    detail:
      "The encrypted transmission decodes to NIGHTOWL — a codename. " +
      "Someone was operating under cover of darkness. The breach was not random; " +
      "it was timed to a specific window.",
    status: "NEW LEAD",
  },
  P2: {
    puzzleCode: "P2",
    title: "CASE NOTE // 02",
    timestamp: "02:15 IST",
    detail:
      "Badge 3048 was inside the server room at the time of the breach. " +
      "The entry scanner's clock was running 10 minutes slow — a discrepancy " +
      "that suggests deliberate tampering with the access log.",
    status: "EVIDENCE",
  },
  P3: {
    puzzleCode: "P3",
    title: "CASE NOTE // 03",
    timestamp: "02:17 IST",
    detail:
      "Four fragments of the breach signal were found inside the room, " +
      "not in the corridor. The intruder had physical access to the terminal. " +
      "This was an inside job.",
    status: "CONTRADICTION",
  },
  P4: {
    puzzleCode: "P4",
    title: "CASE NOTE // 04",
    timestamp: "02:17 IST",
    detail:
      "A USB device was plugged into the terminal. The intruder left " +
      "hardware evidence — they were not just observing, they were extracting " +
      "or implanting data.",
    status: "EVIDENCE",
  },
  P5: {
    puzzleCode: "P5",
    title: "CASE NOTE // 05",
    timestamp: "02:17 IST",
    detail:
      "The file name GREENWASH was recovered from the keylogger. One key too " +
      "far right on the keyboard — a deliberate misdirection or a hurried " +
      "typist. The door holds the original.",
    status: "DISCOVERY",
  },
  P6: {
    puzzleCode: "P6",
    title: "CASE NOTE // 06",
    timestamp: "02:17 IST",
    detail:
      "WATER — the first data the intruder touched, written backwards on the " +
      "glass. Water data. Environmental monitoring. The breach targeted the " +
      "campus water management system.",
    status: "CONNECTION",
  },
  P7: {
    puzzleCode: "P7",
    title: "CASE NOTE // 07",
    timestamp: "02:17 IST",
    detail:
      "The transmission was reversed — a YouTube URL hidden in the signal. " +
      "The intruder embedded a Rickroll in the breach data. Either arrogance " +
      "or a signature. This was someone who wanted to be noticed.",
    status: "DISCOVERY",
  },
  P8: {
    puzzleCode: "P8",
    title: "CASE NOTE // 08",
    timestamp: "02:17 IST",
    detail:
      "The hex payload decodes to RESOURCE. The intruder was exfiltrating " +
      "resource allocation data — budget figures, procurement records, " +
      "something someone wanted to hide.",
    status: "EVIDENCE",
  },
  P9: {
    puzzleCode: "P9",
    title: "CASE NOTE // 09",
    timestamp: "02:17 IST",
    detail:
      "The DATABASE is at the heart of every failure. The intruder targeted " +
      "the central records system. Water, power, and food subsystems stayed " +
      "NORMAL — the attack was surgical.",
    status: "CONNECTION",
  },
  P10: {
    puzzleCode: "P10",
    title: "CASE NOTE // 10",
    timestamp: "02:17 IST",
    detail:
      "Case code assembled: TRAITOR. The letters spell it out. Someone " +
      "inside the organization betrayed the system they were trusted to " +
      "protect. The investigation now has a direction.",
    status: "CONCLUSION",
  },
};

/**
 * Round 2 narrative — the deeper investigation.
 * Each entry reveals what the team's discovery means for the case.
 */
export const ROUND2_NARRATIVE: Record<string, NarrativeEntry> = {
  S1: {
    puzzleCode: "S1",
    title: "CASE NOTE // 11",
    timestamp: "02:30 IST",
    detail:
      "The crumpled draft confirms the figures were FUDGED. Someone altered " +
      "financial records before the breach — the cover-up started before " +
      "the crime was even discovered.",
    status: "NEW LEAD",
  },
  S3: {
    puzzleCode: "S3",
    title: "CASE NOTE // 12",
    timestamp: "02:35 IST",
    detail:
      "Rohan's presentation began at 02:15 — two minutes before the breach. " +
      "A convenient alibi. Either he was genuinely presenting, or someone " +
      "knew the timing would create an airtight cover.",
    status: "CONTRADICTION",
  },
  S4: {
    puzzleCode: "S4",
    title: "CASE NOTE // 13",
    timestamp: "02:40 IST",
    detail:
      "The newspaper crossword reveals MISREPORTING. The campus security " +
      "report was fabricated. The initial timeline given to investigators " +
      "was deliberately wrong.",
    status: "EVIDENCE",
  },
  S5: {
    puzzleCode: "S5",
    title: "CASE NOTE // 14",
    timestamp: "02:42 IST",
    detail:
      "Hidden in the highlighted letters: INTERDEPENDENCE. The systems are " +
      "linked. Compromising one gave access to all. The intruder understood " +
      "the architecture better than the people who built it.",
    status: "DISCOVERY",
  },
  S6: {
    puzzleCode: "S6",
    title: "CASE NOTE // 15",
    timestamp: "02:44 IST",
    detail:
      "The fill-in-the-blanks paragraph reveals MISUNDERSTOOD. The " +
      "whistleblower's warnings were dismissed as paranoia. Someone tried " +
      "to raise the alarm before the breach — and was ignored.",
    status: "CONTRADICTION",
  },
  LAST: {
    puzzleCode: "LAST",
    title: "CASE NOTE // 16",
    timestamp: "02:46 IST",
    detail:
      "The final backup was hidden at the outdoor stage — a physical location " +
      "only someone with campus access would know. The data is recovered. " +
      "Now the investigators must decide: who had the means, the motive, " +
      "and the access?",
    status: "CONCLUSION",
  },
};

/**
 * Get the narrative entry for a solved puzzle, or null if none exists.
 */
export function getNarrativeEntry(
  puzzleCode: string,
  roundCode: string,
): NarrativeEntry | null {
  if (roundCode === "ROUND_1") return ROUND1_NARRATIVE[puzzleCode] ?? null;
  if (roundCode === "ROUND_2") return ROUND2_NARRATIVE[puzzleCode] ?? null;
  return null;
}
