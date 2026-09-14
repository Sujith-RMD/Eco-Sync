-- =============================================================================
-- ECO-SYNC: THE BREACH — which content revision is this database?
--
-- READ-ONLY. Prints nothing but shapes and counts; safe to run at any time,
-- including mid-event. Run it FIRST, in whichever Supabase project you are
-- about to modify, and confirm the chain below is the one you think it is.
--
-- Why this exists: two revisions of Round 2 have existed in the wild —
--
--   * RETIRED (11 rows): S1, ENV_A, S2, ENV_B, S3, S4..S8 "WATER DATA — I..V",
--     FINAL. Seeded from catalogue.ts. S7 here is "WATER DATA — IV" at
--     order_index 9 — NOT the QR puzzle.
--   * SUPPLIED (8 rows): S1, S3, S4, S5, S6, S7, S8, LAST, order_index 1..8.
--     Installed by db/round-2-content.sql. S7 here is
--     "Newspaper — Hidden QR Codes" at order_index 6 — the QR puzzle.
--
-- db/arm-s7.sql matches on code = 'S7' with no order_index constraint, so it
-- arms the right row in the SUPPLIED revision and silently overwrites a WATER
-- DATA answer in the RETIRED one. Identify the revision before arming.
-- =============================================================================

select current_database()                                        as db,
       (select count(*)::int from puzzles p join rounds r on r.id = p.round_id
         where r.code = 'ROUND_1')                               as r1_puzzles,
       (select count(*)::int from puzzles p join rounds r on r.id = p.round_id
         where r.code = 'ROUND_2')                               as r2_puzzles,
       case (select count(*)::int from puzzles p join rounds r on r.id = p.round_id
              where r.code = 'ROUND_2')
         when 8 then 'SUPPLIED revision (round-2-content.sql applied) — arm-s7.sql is safe here'
         when 11 then 'RETIRED revision (seeded from catalogue.ts) — arm-s7.sql would hit WATER DATA IV, do NOT run it'
         else 'UNKNOWN revision — inspect the chain below before changing anything'
       end                                                       as revision;

-- The chain itself: order, code, title, answer length, placeholder-ness.
select p.order_index, p.code, p.kind, p.points,
       length(p.expected_answer_normalized)                 as answer_chars,
       (p.expected_answer_normalized ~ '^__[A-Z0-9_-]+__$') as awaiting_answer,
       p.title
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_2'
 order by p.order_index;

-- Play data. db/round-2-content.sql refuses to replace a round that has any of
-- this; db/arm-s7.sql does not care but should only ever run before opening.
select
  (select count(*)::int from teams)                                as teams,
  (select count(*)::int from score_events)                         as score_events,
  (select count(*)::int from puzzle_attempts)                      as attempts,
  (select count(*)::int from team_puzzle_progress)                 as progress,
  (select count(*)::int from hint_usages)                          as hint_usages,
  (select count(*)::int from round_participations where qualified)  as qualified,
  (select count(*)::int from culprit_votes)                        as votes;

select code, status, started_at, ended_at from rounds order by id;
