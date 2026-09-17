/**
 * Shared newspaper group constants — safe for both server and client.
 *
 * This module exists because the round-console.tsx (a client component) needs
 * to know which puzzle codes belong to the newspaper group for UI filtering,
 * but the full catalogue module is server-only.
 */

export interface NewspaperGroupConfig {
  /** The puzzle code that anchors this group (first in the chain). */
  anchorCode: string;
  /** All puzzle codes in this group, in answer-field display order. */
  codes: string[];
  /** Generic prompt shown to the player instead of individual briefings. */
  prompt: string;
  /** Per-puzzle answer labels shown above each field. */
  fieldLabels: string[];
}

/**
 * The three newspaper-derived puzzles are presented as a single investigation
 * question with three answer fields. The player must recover all three pieces
 * of information from the newspaper; order of submission does not matter.
 */
export const NEWSPAPER_GROUP: NewspaperGroupConfig = {
  anchorCode: "S4",
  codes: ["S4", "S5", "S6"],
  prompt:
    "Investigate the newspaper and recover the three pieces of information hidden within it.",
  fieldLabels: ["Answer 1", "Answer 2", "Answer 3"],
};

const NEWSPAPER_CODE_SET = new Set(NEWSPAPER_GROUP.codes);

/** Check whether a puzzle code belongs to the newspaper group. */
export function isNewspaperGroupMember(code: string): boolean {
  return NEWSPAPER_CODE_SET.has(code);
}
