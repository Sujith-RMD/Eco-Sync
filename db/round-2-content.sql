-- =============================================================================
-- ECO-SYNC: THE BREACH — Round 2 content replacement
--
-- Replaces the 11 placeholder Round 2 puzzles with the 8 supplied questions,
-- in play order: S1, S3, S4, S5, S6, S7, S8, LAST.
--
-- Apply ONCE to each database that serves the game. RESTART deliberately keeps
-- the puzzle chain, so this is the only path that changes what teams read; the
-- Next.js deployment does not re-seed existing rows.
--
--   * Hosted (Supabase dashboard -> SQL Editor): paste this whole file, Run.
--   * Local (psql):  set PGCLIENTENCODING=UTF8
--                    psql -h 127.0.0.1 -U postgres -d app_db -f round-2-content.sql
--
-- S7's answer is a sentinel, not a solution: the two QR payloads were never
-- supplied. Round 2 must not be opened until it is armed (last statement).
-- =============================================================================

begin;

-- Refuse to touch a round that already has play data. Deleting puzzles would
-- cascade those attempts, progress and hint rows away with it.
do $guard$
declare
  referencing bigint;
begin
  select
    (select count(*) from puzzle_attempts pa
       join puzzles p on p.id = pa.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_2'))
  + (select count(*) from team_puzzle_progress tpp
       join puzzles p on p.id = tpp.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_2'))
  + (select count(*) from hint_usages hu
       join puzzles p on p.id = hu.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_2'))
  into referencing;

  if referencing > 0 then
    raise exception
      'Refusing to replace Round 2: % rows of play data reference its puzzles. End and restart the round first.',
      referencing;
  end if;
end
$guard$;

delete from puzzles
 where round_id = (select id from rounds where code = 'ROUND_2');

insert into puzzles
  (round_id, code, order_index, kind, title, briefing,
   expected_answer_normalized, hints, points)
select
  r.id, v.code, v.order_index, v.kind::puzzle_kind, v.title, v.briefing,
  v.expected_answer_normalized, '[]'::jsonb, v.points
from rounds r
cross join (values
  ('S1', 1, 'DIGITAL',
   'The Crumpled Draft',
   E'The culprit threw away a draft somewhere in this room.\nWhat did they do to the figures?',
   'FUDGED', 100),

  ('S3', 2, 'DIGITAL',
   'The Judging Schedule',
   E'When did Rohan''s presentation begin? (HHMM)',
   '0215', 100),

  ('S4', 3, 'DIGITAL',
   'Newspaper — Crossword',
   E'Solve the crossword on page 4.\nTake the first letter of each answer, in hint order.\nWhat was the real crime?',
   'MISREPORTING', 100),

  ('S5', 4, 'DIGITAL',
   'Newspaper — Highlighted Letters',
   E'The highlighted letters on page 2 reveal a hidden word.\nWhat is the word?',
   'INTERDEPENDENCE', 100),

  ('S6', 5, 'DIGITAL',
   'Newspaper — Fill in the Blanks',
   E'Fill in the blanks in the paragraph on page 2.\nWhat word is revealed?',
   'MISUNDERSTOOD', 100),

  ('S7', 6, 'DIGITAL',
   'Newspaper — Hidden QR Codes',
   E'The words “waste” and “podium” point to two QR codes hidden in the room.\nFind and scan both QR codes.\nWhat do they reveal?',
   '__UNARMED__', 100),

  ('S8', 7, 'DIGITAL',
   'The Gate Log',
   E'One suspect''s car is in the gate log, and their statement says they were home all night.\nWhen did that car enter campus? (HHMM)',
   '0158', 100),

  ('LAST', 8, 'FINAL_CODE',
   'Outdoor Backup',
   E'CASE UPDATE: BACKUP LOCATED\nECO-SYNC kept one last backup of the original data.\n\nI have a stage but no roof, and my seats face the open sky.\nFind the backup there.\nDecode it, then return here with the code and the culprit''s name.',
   'TRUTH', 150)
) as v(code, order_index, kind, title, briefing, expected_answer_normalized, points)
where r.code = 'ROUND_2';

comment on table puzzles is
  'Round 2 content: 8 supplied questions, order_index 1..8 contiguous. S7 armed separately.';

commit;

-- ---------------------------------------------------------------------------
-- Verification. Expect exactly 8 rows, order_index 1..8 with no gaps, LAST last.
-- ---------------------------------------------------------------------------
select p.order_index, p.code, p.kind, p.points, p.title,
       p.expected_answer_normalized = '__UNARMED__' as awaiting_answer
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_2'
 order by p.order_index;

select count(*) as rows,
       min(order_index) as first_index,
       max(order_index) as last_index,
       count(distinct order_index) as distinct_indexes
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_2';

-- ---------------------------------------------------------------------------
-- RUNBOOK — arm S7 when the QR payloads are known, then re-run the verify block.
-- The culprit's name asked for at LAST is carried by the vote panel, which this
-- answer unseals; the vote's correct suspect is set in code, not here.
-- ---------------------------------------------------------------------------
-- update puzzles
--    set expected_answer_normalized = '<THE ANSWER, UPPERCASE, NO PADDING>',
--        updated_at = now()
--  where round_id = (select id from rounds where code = 'ROUND_2')
--    and code = 'S7';
