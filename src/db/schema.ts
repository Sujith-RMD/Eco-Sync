import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * ECO-SYNC: THE BREACH — relational schema foundation.
 *
 * Security notes:
 * - Secret material (answer, hint payload, credential hashes) lives ONLY in
 *   columns marked [SERVER-ONLY] and must never be selected into payloads
 *   that are returned to the browser.
 * - Score mutations are expressed as immutable `score_events` rows so the
 *   current score is always re-derivable and auditable.
 * - "One vote per team", "one progress row per team+puzzle", etc. are
 *   enforced with unique constraints at the database level.
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const roundCodeEnum = pgEnum("round_code", ["ROUND_1", "ROUND_2"]);
export const roundStatusEnum = pgEnum("round_status", [
  "PENDING",
  "ACTIVE",
  "ENDED",
]);
export const puzzleKindEnum = pgEnum("puzzle_kind", [
  "DIGITAL",
  "PHYSICAL_CHECKPOINT",
  "FINAL_CODE",
]);
export const puzzleStatusEnum = pgEnum("puzzle_status", [
  "LOCKED",
  "UNLOCKED",
  "SOLVED",
]);
export const scoreEventTypeEnum = pgEnum("score_event_type", [
  "PUZZLE_SOLVED",
  "HINT_USED",
  "WRONG_ANSWER",
  "TIME_BONUS",
  "MANUAL_ADJUSTMENT",
]);
export const actorTypeEnum = pgEnum("actor_type", ["TEAM", "ADMIN", "SYSTEM"]);
export const sessionSubjectEnum = pgEnum("session_subject", ["TEAM", "ADMIN"]);

/* -------------------------------------------------------------------------- */
/* Shared column factories                                                    */
/* -------------------------------------------------------------------------- */

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/* Teams & admins                                                             */
/* -------------------------------------------------------------------------- */

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    /** scrypt hash — [SERVER-ONLY], never sent to clients */
    accessCodeHash: text("access_code_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [index("ix_teams_is_active").on(table.isActive)],
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  /** scrypt hash — [SERVER-ONLY], never sent to clients */
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 120 }),
  createdAt,
  updatedAt,
});

/* -------------------------------------------------------------------------- */
/* Rounds & puzzle catalogue                                                  */
/* -------------------------------------------------------------------------- */

export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  code: roundCodeEnum("code").notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: roundStatusEnum("status").notNull().default("PENDING"),
  /** Authoritative server-side clock. startedAt/endsAt drive every timer. */
  startedAt: timestamp("started_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const puzzles = pgTable(
  "puzzles",
  {
    id: serial("id").primaryKey(),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    /** Public puzzle code, e.g. P1 … P7 / S1 … S8 / FINAL. */
    code: varchar("code", { length: 16 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    kind: puzzleKindEnum("kind").notNull().default("DIGITAL"),
    title: varchar("title", { length: 160 }).notNull(),
    /** Client-safe instructions shown on the dashboard. */
    briefing: text("briefing").notNull(),
    /** Normalized expected answer (trimmed, uppercase) — [SERVER-ONLY]. */
    expectedAnswerNormalized: varchar("expected_answer_normalized", {
      length: 255,
    }).notNull(),
    /** Ordered hint payloads — [SERVER-ONLY] until a hint is claimed. */
    hints: jsonb("hints").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    points: integer("points").notNull().default(100),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("uq_puzzles_round_code").on(table.roundId, table.code),
    uniqueIndex("uq_puzzles_round_order").on(table.roundId, table.orderIndex),
  ],
);

/* -------------------------------------------------------------------------- */
/* Per-team progression                                                       */
/* -------------------------------------------------------------------------- */

export const teamPuzzleProgress = pgTable(
  "team_puzzle_progress",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    puzzleId: integer("puzzle_id")
      .notNull()
      .references(() => puzzles.id, { onDelete: "cascade" }),
    status: puzzleStatusEnum("status").notNull().default("LOCKED"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    solvedAt: timestamp("solved_at", { withTimezone: true }),
    wrongAttempts: integer("wrong_attempts").notNull().default(0),
    /** Absolute points deducted for wrong answers on this puzzle (cap 50). */
    wrongPenaltyPoints: integer("wrong_penalty_points").notNull().default(0),
    hintsUsed: integer("hints_used").notNull().default(0),
    /** Server-enforced submission cooldown. Browser countdowns are cosmetic. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("uq_progress_team_puzzle").on(table.teamId, table.puzzleId),
    index("ix_progress_team").on(table.teamId),
    index("ix_progress_status").on(table.status),
  ],
);

export const puzzleAttempts = pgTable(
  "puzzle_attempts",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    puzzleId: integer("puzzle_id")
      .notNull()
      .references(() => puzzles.id, { onDelete: "cascade" }),
    /** [SERVER-ONLY] raw submission kept for admin forensics. */
    submittedAnswer: text("submitted_answer").notNull(),
    normalizedAnswer: varchar("normalized_answer", { length: 255 }).notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    penaltyApplied: integer("penalty_applied").notNull().default(0),
    createdAt,
  },
  (table) => [
    index("ix_attempts_team_puzzle").on(table.teamId, table.puzzleId),
    index("ix_attempts_created_at").on(table.createdAt),
  ],
);

export const hintUsages = pgTable(
  "hint_usages",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    puzzleId: integer("puzzle_id")
      .notNull()
      .references(() => puzzles.id, { onDelete: "cascade" }),
    hintIndex: integer("hint_index").notNull(),
    penaltyApplied: integer("penalty_applied").notNull().default(30),
    createdAt,
  },
  (table) => [
    uniqueIndex("uq_hint_team_puzzle_index").on(
      table.teamId,
      table.puzzleId,
      table.hintIndex,
    ),
    index("ix_hints_team").on(table.teamId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Scoring — immutable event ledger                                           */
/* -------------------------------------------------------------------------- */

export const scoreEvents = pgTable(
  "score_events",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: integer("round_id").references(() => rounds.id, {
      onDelete: "set null",
    }),
    puzzleId: integer("puzzle_id").references(() => puzzles.id, {
      onDelete: "set null",
    }),
    type: scoreEventTypeEnum("type").notNull(),
    delta: integer("delta").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt,
  },
  (table) => [
    index("ix_score_events_team").on(table.teamId, table.createdAt),
    index("ix_score_events_round").on(table.roundId),
    index("ix_score_events_type").on(table.type),
  ],
);

/* -------------------------------------------------------------------------- */
/* Round participation / qualification / results                              */
/* -------------------------------------------------------------------------- */

export const roundParticipations = pgTable(
  "round_participations",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    /** null = not decided, true = qualified out of this round. */
    qualified: boolean("qualified"),
    finalScore: integer("final_score"),
    finalRank: integer("final_rank"),
    /** Seconds remaining on the server clock when the team finished. */
    remainingSecondsAtFinish: integer("remaining_seconds_at_finish"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("uq_participation_team_round").on(table.teamId, table.roundId),
    index("ix_participation_round").on(table.roundId),
  ],
);

export const culpritVotes = pgTable(
  "culprit_votes",
  {
    id: serial("id").primaryKey(),
    /** One vote per team, forever. */
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    suspectCode: varchar("suspect_code", { length: 80 }).notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("uq_culprit_votes_team").on(table.teamId)],
);

/* -------------------------------------------------------------------------- */
/* Auth sessions & audit trail                                                */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    /** SHA-256 of the bearer token — the raw token only exists in cookies. */
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    subject: sessionSubjectEnum("subject").notNull(),
    teamId: integer("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    adminId: integer("admin_id").references(() => admins.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt,
  },
  (table) => [
    index("ix_sessions_expires_at").on(table.expiresAt),
    index("ix_sessions_team").on(table.teamId),
    index("ix_sessions_admin").on(table.adminId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: integer("actor_id"),
    action: varchar("action", { length: 120 }).notNull(),
    entity: varchar("entity", { length: 80 }),
    entityId: varchar("entity_id", { length: 80 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 45 }),
    createdAt,
  },
  (table) => [
    index("ix_audit_logs_created_at").on(table.createdAt),
    index("ix_audit_logs_actor").on(table.actorType, table.actorId),
    index("ix_audit_logs_action").on(table.action),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations (enable db.query ... with: API)                                  */
/* -------------------------------------------------------------------------- */

export const teamsRelations = relations(teams, ({ many, one }) => ({
  progress: many(teamPuzzleProgress),
  attempts: many(puzzleAttempts),
  hintUsages: many(hintUsages),
  scoreEvents: many(scoreEvents),
  participations: many(roundParticipations),
  sessions: many(sessions),
  culpritVote: one(culpritVotes),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  sessions: many(sessions),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  puzzles: many(puzzles),
  participations: many(roundParticipations),
}));

export const puzzlesRelations = relations(puzzles, ({ one, many }) => ({
  round: one(rounds, { fields: [puzzles.roundId], references: [rounds.id] }),
  progress: many(teamPuzzleProgress),
  attempts: many(puzzleAttempts),
  hintUsages: many(hintUsages),
}));

export const teamPuzzleProgressRelations = relations(
  teamPuzzleProgress,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamPuzzleProgress.teamId],
      references: [teams.id],
    }),
    puzzle: one(puzzles, {
      fields: [teamPuzzleProgress.puzzleId],
      references: [puzzles.id],
    }),
  }),
);

export const puzzleAttemptsRelations = relations(puzzleAttempts, ({ one }) => ({
  team: one(teams, {
    fields: [puzzleAttempts.teamId],
    references: [teams.id],
  }),
  puzzle: one(puzzles, {
    fields: [puzzleAttempts.puzzleId],
    references: [puzzles.id],
  }),
}));

export const hintUsagesRelations = relations(hintUsages, ({ one }) => ({
  team: one(teams, { fields: [hintUsages.teamId], references: [teams.id] }),
  puzzle: one(puzzles, {
    fields: [hintUsages.puzzleId],
    references: [puzzles.id],
  }),
}));

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
  team: one(teams, { fields: [scoreEvents.teamId], references: [teams.id] }),
  round: one(rounds, {
    fields: [scoreEvents.roundId],
    references: [rounds.id],
  }),
  puzzle: one(puzzles, {
    fields: [scoreEvents.puzzleId],
    references: [puzzles.id],
  }),
}));

export const roundParticipationsRelations = relations(
  roundParticipations,
  ({ one }) => ({
    team: one(teams, {
      fields: [roundParticipations.teamId],
      references: [teams.id],
    }),
    round: one(rounds, {
      fields: [roundParticipations.roundId],
      references: [rounds.id],
    }),
  }),
);

export const culpritVotesRelations = relations(culpritVotes, ({ one }) => ({
  team: one(teams, {
    fields: [culpritVotes.teamId],
    references: [teams.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  team: one(teams, { fields: [sessions.teamId], references: [teams.id] }),
  admin: one(admins, { fields: [sessions.adminId], references: [admins.id] }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred row/insert types                                                  */
/* -------------------------------------------------------------------------- */

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Puzzle = typeof puzzles.$inferSelect;
export type TeamPuzzleProgressRow = typeof teamPuzzleProgress.$inferSelect;
export type PuzzleAttempt = typeof puzzleAttempts.$inferSelect;
export type HintUsageRow = typeof hintUsages.$inferSelect;
export type ScoreEvent = typeof scoreEvents.$inferSelect;
export type RoundParticipation = typeof roundParticipations.$inferSelect;
export type CulpritVote = typeof culpritVotes.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
