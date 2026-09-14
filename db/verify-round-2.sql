-- =============================================================================
-- ECO-SYNC: THE BREACH — Round 2 content VERIFIER (read-only w.r.t. game data)
--
-- Proves that the database you are connected to actually contains the eight
-- supplied questions, field by field.
--
-- It prints PASS/FAIL per column rather than answer text, because an operator
-- console is a shoulder-surfed surface in a room full of teams. A boolean proves
-- equality exactly as well as the value does, and leaks nothing.
--
-- The only object created is a TEMPORARY view (this session only, gone when the
-- tab closes) so that the eight expected rows are written ONCE and every report
-- below reads it — no second copy of the content to drift out of sync.
--
--   Run BEFORE applying round-2-content.sql → expect FAILs on placeholder content
--   Run AFTER applying it                   → expect ok = t on all 8 rows,
--     chain_contiguous = t, exactly one FINAL_CODE last, awaiting_answer = f for
--     every link (S7 is armed with the QR payload 'DELETED').
--
-- The Round 1 fingerprint must read identically before and after any Round 2
-- operation. If it moves, the operation touched a round it should not have.
-- =============================================================================

drop view if exists round2_check;

create temp view round2_check as
with expected(code, order_index, kind, points, title, briefing, answer) as (
  values
    ('S1', 1, 'DIGITAL', 100,
     'The Crumpled Draft',
     E'The culprit threw away a draft somewhere in this room.\nWhat did they do to the figures?',
     'FUDGED'),
    ('S3', 2, 'DIGITAL', 100,
     'The Judging Schedule',
     E'When did Rohan''s presentation begin? (HHMM, no colon)',
     '0215'),
    ('S4', 3, 'DIGITAL', 100,
     'Newspaper — Crossword',
     E'Solve the crossword on page 4.\nTake the first letter of each answer, in hint order.\nWhat was the real crime?',
     'MISREPORTING'),
    ('S5', 4, 'DIGITAL', 100,
     'Newspaper — Highlighted Letters',
     E'The highlighted letters on page 2 reveal a hidden word.\nWhat is the word?',
     'INTERDEPENDENCE'),
    ('S6', 5, 'DIGITAL', 100,
     'Newspaper — Fill in the Blanks',
     E'Fill in the blanks in the paragraph on page 2.\nWhat word is revealed?',
     'MISUNDERSTOOD'),
    ('S7', 6, 'DIGITAL', 100,
     'Newspaper — Hidden QR Codes',
     E'The words “waste” and “podium” point to two QR codes hidden in the room.\nFind and scan both QR codes.\nWhat do they reveal?',
     'DELETED'),
    ('S8', 7, 'DIGITAL', 100,
     'The Gate Log',
     E'One suspect''s car is in the gate log, and their statement says they were home all night.\nWhen did that car enter campus? (HHMM, no colon)',
     '0158'),
    ('LAST', 8, 'FINAL_CODE', 150,
     'Outdoor Backup',
     E'CASE UPDATE: BACKUP LOCATED\nECO-SYNC kept one last backup of the original data.\n\nI have a stage but no roof, and my seats face the open sky.\nFind the backup there.\nDecode it, then return here with the code and the culprit''s name.',
     'TRUTH')
), live as (
  select p.code, p.order_index, p.kind::text as kind, p.points,
         p.title, p.briefing, p.expected_answer_normalized as answer,
         jsonb_array_length(p.hints) as hint_count
    from puzzles p
    join rounds r on r.id = p.round_id
   where r.code = 'ROUND_2'
)
select
  coalesce(e.code, l.code)                     as code,
  (l.code is not null)                         as row_present,
  (e.code is not null)                         as row_expected,
  (l.order_index = e.order_index)              as ok_order,
  (l.kind = e.kind)                            as ok_kind,
  (l.points = e.points)                        as ok_points,
  (l.title = e.title)                          as ok_title,
  (l.briefing = e.briefing)                    as ok_briefing,
  (l.answer = e.answer)                        as ok_answer,
  coalesce(l.hint_count, -1)                   as hints,
  -- Placeholder-SHAPED, not "equal to one legacy string": the guard in
  -- db/arm-s7.sql and src/server/game/content-guard.ts both refuse any
  -- __LIKE_THIS__ value, so a future placeholder must light this up too.
  coalesce(l.answer ~ '^__[A-Z0-9_-]+__$', false) as awaiting_answer
from expected e
full outer join live l on l.code = e.code;

/* ---- 1. per-row comparison ------------------------------------------------ */
select code,
       (row_present and row_expected)                       as ok,
       ok_order, ok_kind, ok_points, ok_title, ok_briefing, ok_answer,
       awaiting_answer                                      as awaiting_answer,
       hints
  from round2_check
 order by code nulls last;

/* ---- 2. one verdict line, so nobody has to count ticks -------------------- */
select count(*)                                            as rows_compared,
       count(*) filter (where not (row_present and row_expected))
                                                           as rows_wrong,
       count(*) filter (where ok_answer is not true)       as answers_wrong,
       count(*) filter (where ok_briefing is not true)     as briefings_wrong,
       bool_and(row_present and row_expected and ok_order and ok_kind
                and ok_points and ok_title and ok_briefing and ok_answer)
                                                           as all_match,
       case when bool_and(row_present and row_expected and ok_order and ok_kind
                           and ok_points and ok_title and ok_briefing and ok_answer)
            then 'ROUND 2 CONTENT MATCHES THE SUPPLIED QUESTIONS'
            else 'ROUND 2 CONTENT IS WRONG — apply db/round-2-content.sql, then re-run this file'
       end                                                 as verdict,
       count(*) filter (where awaiting_answer)             as puzzles_needing_arming
  from round2_check;

/* ---- 3. chain integrity --------------------------------------------------- */
/* A gap is not cosmetic: submitAnswer unseals order_index + 1 by exact match, so
   a missing position strands every later puzzle and the vote behind it. */
select count(*)                                           as puzzles,
       min(order_index)                                  as first_position,
       max(order_index)                                  as last_position,
       count(distinct order_index)                       as distinct_positions,
       (count(*) = count(distinct order_index)
        and min(order_index) = 1
        and max(order_index) = count(*))                 as chain_contiguous,
       sum(points)                                       as total_points,
       count(*) filter (where kind = 'FINAL_CODE')       as final_code_puzzles,
       (select p.code from puzzles p
          join rounds r on r.id = p.round_id
         where r.code = 'ROUND_2'
         order by p.order_index desc limit 1)            as last_puzzle_code
from puzzles p
join rounds r on r.id = p.round_id
where r.code = 'ROUND_2';

/* ---- 4. inputs the repair and the opening depend on ----------------------- */
/* The replacement refuses to run while play data references Round 2's puzzles. */
select (select status from rounds where code = 'ROUND_1') as round_1_status,
       (select status from rounds where code = 'ROUND_2') as round_2_status,
       (select count(*) from puzzle_attempts pa
          join puzzles p on p.id = pa.puzzle_id
          join rounds r on r.id = p.round_id
         where r.code = 'ROUND_2')                         as round_2_attempts,
       (select count(*) from team_puzzle_progress tpp
          join puzzles p on p.id = tpp.puzzle_id
          join rounds r on r.id = p.round_id
         where r.code = 'ROUND_2')                        as round_2_progress_rows,
       (select count(*) from hint_usages hu
          join puzzles p on p.id = hu.puzzle_id
          join rounds r on r.id = p.round_id
         where r.code = 'ROUND_2')                        as round_2_hint_usages,
       -- culprit_votes is team-scoped, not round-scoped: one vote per unit, ever.
       (select count(*) from culprit_votes)              as votes_sealed_event_wide,
       (select count(*) from teams)                      as units_registered;

/* ---- 5. Round 1 must be untouched ---------------------------------------- */
/* Hash of hashes: identifies the content without printing any of it. Compare
   before and after a Round 2 operation — the value must not move. */
select md5(string_agg(
         p.code || '|' || p.order_index || '|' || p.kind::text || '|' || p.points
         || '|' || md5(p.expected_answer_normalized), ',' order by p.order_index)
       )                                                   as round_1_fingerprint,
       count(*)                                            as round_1_puzzles
from puzzles p
join rounds r on r.id = p.round_id
where r.code = 'ROUND_1';
