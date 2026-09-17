-- Round 2 current content migration.
-- Refuses to run after Round 2 play data exists.

begin;

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
      'Refusing to migrate Round 2: % rows of play data reference its puzzles. Restart/purge Round 2 first.',
      referencing;
  end if;
end
$guard$;

-- Free the unique order-index constraint while the chain is reshaped.
update puzzles
set order_index = -id
where round_id = (select id from rounds where code = 'ROUND_2');

-- Remove stale chain links. This does not touch Round 1.
delete from puzzles
where round_id = (select id from rounds where code = 'ROUND_2')
  and code in ('S7', 'S8');

insert into puzzles
  (round_id, code, order_index, kind, title, briefing,
   expected_answer_normalized, hints, points)
select
  r.id, v.code, v.order_index, v.kind::puzzle_kind, v.title, v.briefing,
  v.answer, '[]'::jsonb, v.points
from rounds r
cross join (values
  ('S1', 1, 'DIGITAL', 'THE AUDIT NOTE',
   E'Figures for this quarter are looking excellent.\nUsage of water is down almost 30 percent.\nDon''t worry about the audit, it''s routine.\nGreen Campus rating should be ours this year.\nEverything in ECO-SYNC is under control.\nDestroy this note after reading.\n\nWhat is hidden in the note?', 'FUDGED', 100),
  ('S2', 2, 'DIGITAL', 'THE FOUR WALLS',
    E'Four physical sheets were recovered from the investigation room. Together, they form a cipher key.\nUse the four sheets to decode the recovered transmission and reverse it.', 'SUSTAINABILITY', 100),
  ('S3', 3, 'DIGITAL', 'The Judging Schedule',
    E'OVERNIGHT HACKATHON: JUDGING ROUND, CS LAB\n\nFirst presentation starts at 1:00 AM.\n\nEach team gets 12 minutes, plus 3 minutes to change over.\n\nPresenting order: Team Byte, Team Loop, Team Kernel, Team Pixel, Team Stack, Team NightOwl (R. Das), Team Null.\n\nWhen did Rohan''s presentation begin? (HHMM, no colon)', '0215', 100),
  ('S4', 4, 'DIGITAL', 'Newspaper Evidence',
   E'Recover the hidden message from page 4 of the newspaper.', 'MISREPORTING', 100),
  ('S4a', 100, 'DIGITAL', 'Newspaper Evidence',
   E'Recover the hidden message from page 2 of the newspaper.', 'INTERDEPENDENCE', 100),
  ('S4b', 101, 'DIGITAL', 'Newspaper Evidence',
   E'Recover the hidden message from page 2 of the newspaper.', 'MISUNDERSTOOD', 100),
  ('S5', 5, 'DIGITAL', 'Hidden QR Codes',
   E'Two QR codes were found in the room. Scan both and recover the hidden words.', 'RECYCLING', 100),
  ('S5a', 110, 'DIGITAL', 'Hidden QR Codes',
   E'Recover the hidden word from the first QR code.', 'RECYCLING', 100),
  ('S5b', 111, 'DIGITAL', 'Hidden QR Codes',
   E'Recover the hidden word from the second QR code.', 'SEGREGATION', 100),
  ('S6', 6, 'DIGITAL', 'The Gate Log',
   E'One suspect''s car is in the gate log.\nWhen did that car enter campus?', '0158', 100),
  ('LAST', 7, 'FINAL_CODE', 'Outdoor Backup',
   E'CASE UPDATE: BACKUP LOCATED\nECO-SYNC kept one last backup of the original data.\n\nI have a stage but no roof, and my seats face the open sky.\nFind the backup there.\nDecode it, then return here with the code and the culprit''s name.', 'TRUTH', 150)
) as v(code, order_index, kind, title, briefing, answer, points)
where r.code = 'ROUND_2'
on conflict (round_id, code) do update
set order_index = excluded.order_index,
    kind = excluded.kind,
    title = excluded.title,
    briefing = excluded.briefing,
    expected_answer_normalized = excluded.expected_answer_normalized,
    hints = excluded.hints,
    points = excluded.points;

commit;

select p.code, p.order_index, p.expected_answer_normalized
from puzzles p
join rounds r on r.id = p.round_id
where r.code = 'ROUND_2'
order by p.order_index, p.code;
