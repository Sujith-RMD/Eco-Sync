-- =============================================================================
-- ECO-SYNC: THE BREACH — arm S7 (Newspaper — Hidden QR Codes)
--
-- S7 is the only Round 2 link whose answer is a placeholder, and it sits at
-- position 6 of 8: LAST and the culprit vote are directly behind it. Until this
-- runs, opening Round 02 is refused by the engine's content guard.
--
-- HOW TO GET THE PAYLOAD — do not type it from memory:
--   1. Scan each printed QR code with a phone (the same camera the teams use).
--   2. Copy the decoded text exactly as it appears.
--   3. Paste it into the ONE line marked EDIT ME below.
--
-- WHAT THE ENGINE COMPARES AGAINST (rules.ts normalizeAnswer):
--   Unicode NFKC  →  every whitespace run collapsed to one space  →  trimmed  →
--   UPPERCASE.  Punctuation and spaces INSIDE the answer are preserved.
--   So a submission of "unarmed  sentinel" matches "UNARMED SENTINEL", while
--   "UNARMEDSENTINEL" does not, and neither does a colon or full stop.
--   This script applies the same upper/trim/collapse to what you paste, and
--   rejects non-ASCII, so the stored value cannot drift from what a phone can
--   actually produce.
--
-- AFTERWARDS: run db/verify-round-2.sql (the arming flag must go false), update
-- ROUND2_PUZZLES in src/server/game/catalogue.ts to the same value, and fix the
-- deliberate tripwire in tests/engine/content-guard.test.ts — the database and
-- the catalogue must say the same thing, or the next repair re-introduces this.
-- =============================================================================

begin;

do $arm$
declare
  -- ↓↓↓ EDIT THIS ONE LINE: paste the text the QR codes decode to. ↓↓↓
  payload constant text := 'REPLACE_WITH_SCANNED_TEXT';
  -- ↑↑↑ nothing below this line needs changing. ↑↑↑

  -- The unfilled-template check is assembled from split literals on purpose: a
  -- find-and-replace of the payload above must not rewrite the comparison it is
  -- tested against, or the script would refuse every real answer forever.
  marker constant text := 'REPLACE' || '_WITH_SCANNED_TEXT';

  cleaned text;
begin
  if payload = marker then
    raise exception 'S7 is still un-armed: put the scanned QR text in the payload line first.';
  end if;

  cleaned := upper(regexp_replace(btrim(payload), '\s+', ' ', 'g'));

  if length(cleaned) < 3 then
    raise exception 'Refusing to store a % character answer — too short to be a real payload.', length(cleaned);
  end if;

  -- Anything shaped like a marker is a placeholder, not an answer.
  if cleaned ~ '^__[A-Z0-9_-]+__$' then
    raise exception 'Refusing to store a % character value shaped like a placeholder marker (__LIKE_THIS__). Paste the text the QR actually decodes to.', length(cleaned);
  end if;

  -- normalizeAnswer applies NFKC, which plain SQL cannot; keep the stored value
  -- in the ASCII range so the comparison cannot disagree later. Common cause:
  -- pasting from a document that turned straight quotes into typographic ones.
  if cleaned ~ '[^\u0020-\u007E]' then
    raise exception 'Refusing to store a % character answer containing non-ASCII characters (printable ASCII only). Re-type it by hand rather than pasting from a document.', length(cleaned);
  end if;

  update puzzles
     set expected_answer_normalized = cleaned,
         updated_at = now()
   where code = 'S7'
     and round_id = (select id from rounds where code = 'ROUND_2');

  if not found then
    raise exception 'No S7 row in ROUND_2 — apply db/round-2-content.sql first.';
  end if;

  raise notice 'S7 armed with a % character answer (value not printed).', length(cleaned);
end
$arm$;

-- ---------------------------------------------------------------------------
-- Verification. Booleans only — the answer itself is never printed here.
-- ---------------------------------------------------------------------------
select code,
       order_index,
       (expected_answer_normalized <> '__UNARMED__')            as no_longer_marker,
       (expected_answer_normalized !~ '^__[A-Z0-9_-]+__$')      as not_placeholder_shaped,
       (expected_answer_normalized = upper(btrim(expected_answer_normalized)))
                                                                as stored_normalized,
       (expected_answer_normalized !~ '[^\u0020-\u007E]')       as printable_ascii,
       length(expected_answer_normalized)                       as characters
  from puzzles
 where round_id = (select id from rounds where code = 'ROUND_2')
   and code = 'S7';

select count(*) filter (where expected_answer_normalized ~ '^__[A-Z0-9_-]+__$')
       as still_unarmed_in_round_2,
       case when count(*) filter (where expected_answer_normalized ~ '^__[A-Z0-9_-]+__$') = 0
            then 'ROUND 2 IS ARMED — Open Round 02 will be permitted.'
            else 'ROUND 2 STILL HAS A PLACEHOLDER — opening remains blocked.'
       end as verdict
  from puzzles
 where round_id = (select id from rounds where code = 'ROUND_2');

commit;
