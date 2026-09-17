/**
 * Shared multi-answer group constants — safe for both server and client.
 *
 * This module exists because the round-console.tsx (a client component) needs
 * to know which puzzle codes belong to multi-answer groups for UI filtering,
 * but the full catalogue module is server-only.
 */

export interface MultiAnswerGroupConfig {
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
export const NEWSPAPER_GROUP: MultiAnswerGroupConfig = {
  anchorCode: "S4",
  codes: ["S4", "S4a", "S4b"],
  prompt:
    "Investigate the newspaper and recover the three pieces of information hidden within it.",
  fieldLabels: ["Answer 1", "Answer 2", "Answer 3"],
};

/**
 * The two QR code puzzles are presented as a single investigation
 * question with two answer fields. The player must recover both pieces
 * of information from the QR codes; order of submission does not matter.
 */
export const QR_GROUP: MultiAnswerGroupConfig = {
  anchorCode: "S5",
  codes: ["S5a", "S5b"],
  prompt:
    'Two QR codes were found in the room. Scan both and recover the hidden words.',
  fieldLabels: ["QR Code 1", "QR Code 2"],
};

/**
 * All multi-answer groups.
 */
export const MULTI_ANSWER_GROUPS: MultiAnswerGroupConfig[] = [
  NEWSPAPER_GROUP,
  QR_GROUP,
];

/**
 * All puzzle codes that belong to any multi-answer group.
 */
const MULTI_ANSWER_CODE_SET = new Set(
  MULTI_ANSWER_GROUPS.flatMap((g) =>
    g.codes.filter((code) => code !== g.anchorCode),
  ),
);

/**
 * Check whether a puzzle code belongs to any multi-answer group.
 */
export function isMultiAnswerGroupMember(code: string): boolean {
  return MULTI_ANSWER_CODE_SET.has(code);
}

/**
 * Get the multi-answer group for a puzzle code, or null if not grouped.
 */
export function getMultiAnswerGroup(code: string): MultiAnswerGroupConfig | null {
  for (const group of MULTI_ANSWER_GROUPS) {
    if (group.anchorCode === code || group.codes.includes(code)) return group;
  }
  return null;
}

/**
 * Get the multi-answer group by its anchor code.
 */
export function getMultiAnswerGroupByAnchor(anchorCode: string): MultiAnswerGroupConfig | null {
  return MULTI_ANSWER_GROUPS.find((g) => g.anchorCode === anchorCode) ?? null;
}