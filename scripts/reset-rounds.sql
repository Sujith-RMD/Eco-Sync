-- ---------------------------------------------------------------------------
-- Soft reset of both rounds back to PENDING (rehearsal helper).
--
-- WHY THIS EXISTS: the engine's round state machine is deliberately one-way
-- (PENDING -> ACTIVE -> ENDED, see the one-way transition guards in
-- src/server/game/engine.ts). The command deck's everyday reset is now RESTART
-- (restartEventAction), which supersedes this script: it clears the same two
-- things AND the ledger, attempts, hints and verdicts, releases the sign-in
-- throttle, drops team sessions, refuses while a round is still ACTIVE, is
-- rate-limited, and writes an event.restart audit row.
--
-- So treat this script as the fallback for when the deck cannot be reached --
-- operator locked out, deployment down, no admin session. Prefer RESTART when
-- the deck is up.
--
-- WHAT IT CLEARS: round_participations (Round 01 final rankings + the Round 02
-- qualified roster written by "Qualify top 15") and the started_at/ended_at
-- stamps on the two round rows. Standings are derived from the score ledger,
-- so with an empty ledger nothing else has to change. The teams, their access
-- codes and the puzzle catalogue are preserved.
--
-- SAFETY: aborts before committing if any score_events or team_puzzle_progress
-- rows exist. That is the point at which a soft reset would silently rewrite
-- competitive history (score_events is append-only by design) - use the
-- audited PURGE from the command deck instead.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/reset-rounds.sql
-- ---------------------------------------------------------------------------
\set ON_ERROR_STOP on

BEGIN;

-- Preflight: refuse to touch a board that carries real results.
DO $do$
DECLARE
  v_score    bigint;
  v_progress bigint;
  v_votes    bigint;
BEGIN
  SELECT count(*) INTO v_score    FROM score_events;
  SELECT count(*) INTO v_progress FROM team_puzzle_progress;
  SELECT count(*) INTO v_votes    FROM culprit_votes;

  IF v_score > 0 OR v_progress > 0 OR v_votes > 0 THEN
    RAISE EXCEPTION
      'Refusing soft reset: score=%, progress=%, votes=%. Teams have played. '
      'Use "Purge event data" in the command deck instead.',
      v_score, v_progress, v_votes;
  END IF;
END
$do$;

SELECT 'before: ' || string_agg(code || ' = ' || status
         || ' (started ' || coalesce(to_char(started_at, 'HH24:MI:SS'), '-')
         || ', ended '  || coalesce(to_char(ended_at,  'HH24:MI:SS'), '-')
         || ')', ' | ')                          AS state,
       (SELECT count(*) FROM round_participations) AS participations
FROM rounds;

DELETE FROM round_participations;

UPDATE rounds
SET status     = 'PENDING',
    started_at = NULL,
    ended_at   = NULL;

SELECT 'after: ' || string_agg(code || ' = ' || status
         || ' (started ' || coalesce(to_char(started_at, 'HH24:MI:SS'), '-')
         || ', ended '  || coalesce(to_char(ended_at,  'HH24:MI:SS'), '-')
         || ')', ' | ')                          AS state,
       (SELECT count(*) FROM round_participations) AS participations,
       (SELECT count(*) FROM teams)                 AS teams_kept,
       (SELECT count(*) FROM puzzles)               AS puzzles_kept
FROM rounds;

COMMIT;

SELECT 'RESET COMPLETE - both rounds are PENDING; Start controls are back on /admin.' AS result;
