-- =============================================================================
-- ECO-SYNC: THE BREACH — is this database ready to run the event?
--
-- READ-ONLY. Creates nothing, writes nothing, no TEMP objects, no transaction.
-- Safe at any time, on any project, including mid-event and in front of anyone.
--
-- It prints COUNTS and BOOLEANS, never answer text. An operator console is a
-- shoulder-surfed surface in a room full of teams, and a boolean proves equality
-- exactly as well as the value does — same convention as db/verify-round-2.sql.
--
-- Run this after applying db/roster-rename.sql and db/round-1-content.sql, and
-- expect:
--
--     teams 61, legacy_unit_rows 0
--     round_1 10 links, contiguous 1..10, unarmed 0
--     round_2  8 links, contiguous 1..8,  unarmed 0
--     both rounds PENDING
--     attempts / progress / hints / votes / ledger all 0
--
-- Anything else in the two "verdict" rows means stop and read the section above
-- it. The most dangerous near-miss is a chain that is the right LENGTH but not
-- contiguous: submitAnswer unseals order_index + 1 by exact match, so a single
-- gap strands every later link and the round becomes unplayable.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. WHICH DATABASE IS THIS, AND IS THE ROSTER RENAMED?
--
-- legacy_unit_rows must be 0. If it is 60, db/roster-rename.sql has not been
-- applied to THIS project — which is the whole reason this section prints the
-- database name first. Applying a migration to the wrong Supabase project looks
-- exactly like applying it correctly.
-- ---------------------------------------------------------------------------
select current_database()                                                     as database,
       (select count(*) from teams)::int                                      as teams_total,
       (select count(*) from teams where name ~* '^unit-[0-9]+$')::int        as legacy_unit_rows,
       (select count(*) from teams where name ~* '^team#')::int               as team_rows;

-- Every designation, in id order. Codes are not secrets; answers are, and none
-- are printed here.
select id, name from teams order by id;


-- ---------------------------------------------------------------------------
-- 2. THE ROUNDS
--
-- Both must be PENDING before the event, and duration_minutes must be 40 and 75.
-- ---------------------------------------------------------------------------
select code, status, duration_minutes, started_at, ends_at
  from rounds order by code;


-- ---------------------------------------------------------------------------
-- 3. ROUND 1 — the chain that was extended from 7 links to 10
--
-- Expect links 10, first_index 1, last_index 10, distinct_indexes 10,
-- contiguous true, unarmed 0.
-- ---------------------------------------------------------------------------
select count(*)::int                                        as links,
       min(order_index)                                     as first_index,
       max(order_index)                                     as last_index,
       count(distinct order_index)::int                     as distinct_indexes,
       (min(order_index) = 1 and count(*) = max(order_index)) as contiguous,
       (count(*) filter (
          where expected_answer_normalized ~ '^__[A-Z0-9_-]+__$'
             or expected_answer_normalized = ''
       ))::int                                              as unarmed
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_1';

select p.order_index, p.code, p.points, p.title
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_1'
 order by p.order_index;


-- ---------------------------------------------------------------------------
-- 4. ROUND 2 — unchanged, but confirm nothing was disturbed
--
-- Expect links 8, contiguous true, unarmed 0.
-- ---------------------------------------------------------------------------
select count(*)::int                                        as links,
       min(order_index)                                     as first_index,
       max(order_index)                                     as last_index,
       count(distinct order_index)::int                     as distinct_indexes,
       (min(order_index) = 1 and count(*) = max(order_index)) as contiguous,
       (count(*) filter (
          where expected_answer_normalized ~ '^__[A-Z0-9_-]+__$'
             or expected_answer_normalized = ''
       ))::int                                              as unarmed
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_2';


-- ---------------------------------------------------------------------------
-- 5. PLAY DATA — all zero on a database that has not been played
--
-- If these are non-zero you are looking at a database someone has already
-- played. That is not a fault, but it does mean the content migrations will
-- refuse to run (by design), and RESTART is the only way back to a clean board.
-- ---------------------------------------------------------------------------
select (select count(*) from puzzle_attempts)::int       as attempts,
       (select count(*) from team_puzzle_progress)::int  as progress,
       (select count(*) from hint_usages)::int           as hints,
       (select count(*) from culprit_votes)::int         as votes,
       (select count(*) from sessions)::int              as sessions,
       (select count(*) from score_events)::int          as ledger_rows;


-- ---------------------------------------------------------------------------
-- 6. VERDICT
-- ---------------------------------------------------------------------------
select
  case when (select count(*) from teams) = 61
        and not exists (select 1 from teams where name ~* '^unit-[0-9]+$')
       then 'ok' else 'CHECK ROSTER' end                                   as roster,
  case when (select count(*) from puzzles p join rounds r on r.id = p.round_id
              where r.code = 'ROUND_1') = 10
       then 'ok' else 'CHECK ROUND 1' end                                  as round_1,
  case when (select count(*) from puzzles p join rounds r on r.id = p.round_id
              where r.code = 'ROUND_2') = 8
       then 'ok' else 'CHECK ROUND 2' end                                  as round_2,
  case when not exists (select 1 from rounds where status <> 'PENDING')
       then 'ok' else 'A ROUND IS NOT PENDING' end                         as rounds,
  case when (select count(*) from puzzle_attempts)
         + (select count(*) from team_puzzle_progress)
         + (select count(*) from hint_usages)
         + (select count(*) from culprit_votes) = 0
       then 'ok' else 'HAS BEEN PLAYED' end                                as play_data;
