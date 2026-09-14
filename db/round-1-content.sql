-- =============================================================================
-- ECO-SYNC: THE BREACH — Round 1 content (10 links, P1→P10)
--
-- GENERATED FILE — DO NOT EDIT BY HAND.
--   Regenerate with:
--     npx tsx scripts/apply-round1-content.ts --emit-sql > db/round-1-content.sql
--
-- Written by hand it would be a second copy of the answers, and a second copy
-- is what drifts: db/arm-s7.sql exists because a hand-maintained value fell out
-- of step with the catalogue. Everything below comes from ROUND1_PUZZLES,
-- normalized through the engine's own normalizeAnswer, so the stored answer and
-- the grader cannot disagree.
--
-- WHERE TO RUN IT
--   * Supabase: Dashboard -> SQL Editor -> New query, paste this whole file, Run.
--   * Local:    psql -h 127.0.0.1 -U postgres -d app_db -f db/round-1-content.sql
--
-- WHAT IT DOES
--   Upserts by (round_id, code), so it is safe to re-run and safe on a database
--   that already holds the older 7-link chain: P1-P7 are rewritten in place and
--   P8-P10 are inserted. It does NOT delete anything.
--
-- It refuses to run against a Round 1 that has been played. order_index is what
-- the unlock chain keys on, so rewriting it mid-round strands every later link
-- and the case code never unseals.
-- =============================================================================

begin;

do $guard$
declare
  referencing bigint;
begin
  select
    (select count(*) from puzzle_attempts pa
       join puzzles p on p.id = pa.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_1'))
  + (select count(*) from team_puzzle_progress tpp
       join puzzles p on p.id = tpp.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_1'))
  + (select count(*) from hint_usages hu
       join puzzles p on p.id = hu.puzzle_id
      where p.round_id = (select id from rounds where code = 'ROUND_1'))
  into referencing;

  if referencing > 0 then
    raise exception
      'Refusing to rewrite Round 1: % rows of play data reference its puzzles. End and restart the round first.',
      referencing;
  end if;
end
$guard$;

insert into puzzles
  (round_id, code, order_index, kind, title, briefing,
   expected_answer_normalized, hints, points)
select
  r.id, v.code, v.order_index, v.kind::puzzle_kind, v.title, v.briefing,
  v.expected_answer_normalized, v.hints, v.points
from rounds r
cross join (values
    ($eco$P1$eco$, 1, $eco$DIGITAL$eco$, $eco$COLD BOOT$eco$, $eco$SYSTEM OFFLINE. BREACH DETECTED AT 02:17
Last message recovered: SXDBENOB KVSKC XSQRDYGV
Add the digits of the time. Then step back.$eco$, $eco$NIGHTOWL$eco$, $eco$["The digits of 02:17 add up to a number. Move each letter back that many places in the alphabet. Enter one word, no spaces."]$eco$::jsonb, 100),
    ($eco$P2$eco$, 2, $eco$DIGITAL$eco$, $eco$BADGE LOG$eco$, $eco$Badge | Entry | Exit
1107 | 01:50 | 02:15
2291 | 02:10 | 02:45
3048 | 02:05 | 02:30
4415 | 01:30 | 02:16

Security note: the entry scanner's clock runs 10 minutes slow. Which badge was inside at 2:17 AM?$eco$, $eco$3048$eco$, $eco$["Only the entry scanner is wrong. Push every ENTRY time forward by 10 minutes and leave the exit times as printed. Enter the four digits."]$eco$::jsonb, 100),
    ($eco$P3$eco$, 3, $eco$DIGITAL$eco$, $eco$FOUR FRAGMENTS$eco$, $eco$The breach signal left 4 fragments in this room. Find them.$eco$, $eco$LIBRARY$eco$, $eco$["All four fragments are inside your own room, never in the corridor. Join them in the order they are numbered and enter one word."]$eco$::jsonb, 100),
    ($eco$P4$eco$, 4, $eco$DIGITAL$eco$, $eco$THE MARK$eco$, $eco$The intruder left a mark on the machine in your room. What did they plug into the terminal?$eco$, $eco$USB$eco$, $eco$["Three letters. Name the kind of device, not a brand."]$eco$::jsonb, 100),
    ($eco$P5$eco$, 5, $eco$DIGITAL$eco$, $eco$ONE KEY TOO FAR$eco$, $eco$The keylogger caught the file name, but the intruder typed in the dark, one key too far right. Check the door.$eco$, $eco$GREENWASH$eco$, $eco$["Read what is on the door, then move one key to the LEFT on a QWERTY keyboard for every character. One word."]$eco$::jsonb, 100),
    ($eco$P6$eco$, 6, $eco$DIGITAL$eco$, $eco$ON THE GLASS$eco$, $eco$The first data they touched is written backwards on the glass.$eco$, $eco$WATER$eco$, $eco$["Copy the word off the glass exactly as it appears, then read your copy from the other end. Five letters."]$eco$::jsonb, 100),
    ($eco$P7$eco$, 7, $eco$DIGITAL$eco$, $eco$RECOVERED TRANSMISSION$eco$, $eco$The signal appears to have been transmitted backwards.
Restore the transmission and follow where it leads.

33=xedni&nDaXbcZKzsGVksDs01yRDlP_wPmIPL1NLP=tsil&AnDXWiP971t=v?$eco$, $eco$T179PIWXDNA$eco$, $eco$["It is reversed end to end, not word by word. Turn it around and it reads as a YouTube link — enter the eleven characters that follow v=."]$eco$::jsonb, 100),
    ($eco$P8$eco$, 8, $eco$DIGITAL$eco$, $eco$PACKET CAPTURE$eco$, $eco$Decode the hexadecimal payload and recover the hidden message.

[IMG:puzzles/packet-capture.png]$eco$, $eco$RESOURCE$eco$, $eco$["Every pair of hex digits is one character. 52 is R and 45 is E — read all eight pairs the same way."]$eco$::jsonb, 100),
    ($eco$P9$eco$, 9, $eco$DIGITAL$eco$, $eco$SYSTEM LOG$eco$, $eco$The logs show a chain of failures escalating from connection to access, ending with a lost connection.
Which subsystem is at the heart of the failure?

[IMG:puzzles/system-log.png]$eco$, $eco$DATABASE$eco$, $eco$["Every failing row names the same system in the first column, and the water, power and food rows around them stay NORMAL."]$eco$::jsonb, 100),
    ($eco$P10$eco$, 10, $eco$DIGITAL$eco$, $eco$THE CASE CODE$eco$, $eco$Build the case code. Each tag is Puzzle number, then letter position.
6-3 · 5-2 · 3-5 · 1-2 · 1-5 · 1-6 · 6-5$eco$, $eco$TRAITOR$eco$, $eco$["Take each letter from the answer you already submitted for that puzzle, counting from the first character. Seven letters."]$eco$::jsonb, 150)
) as v(code, order_index, kind, title, briefing, expected_answer_normalized, hints, points)
where r.code = 'ROUND_1'
on conflict (round_id, code) do update set
  order_index                = excluded.order_index,
  kind                       = excluded.kind,
  title                      = excluded.title,
  briefing                   = excluded.briefing,
  expected_answer_normalized = excluded.expected_answer_normalized,
  hints                      = excluded.hints,
  points                     = excluded.points;

commit;

-- ---------------------------------------------------------------------------
-- Verification. Expect 10 rows, order_index 1..10 with no
-- gaps, no strays, and awaiting_answer = f on every row.
-- ---------------------------------------------------------------------------
select p.order_index, p.code, p.points, p.title,
       p.expected_answer_normalized ~ '^__[A-Z0-9_-]+__$' as awaiting_answer,
       p.expected_answer_normalized = '' as blank_answer,
       jsonb_array_length(p.hints) as hints
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_1'
 order by p.order_index;

select count(*) as rows,
       min(order_index) as first_index,
       max(order_index) as last_index,
       count(distinct order_index) as distinct_indexes
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = 'ROUND_1';
