-- =============================================================================
-- ECO-SYNC: THE BREACH — arm S7 (Newspaper — Hidden QR Codes)
--
-- S7 sits at position 6 of 8: LAST and the culprit vote are directly behind it.
-- While its answer was the __UNARMED__ placeholder, the engine's content guard
-- refused to open Round 02.
--
-- THE PAYLOAD IS GENERATED, NOT SCANNED: no QR codes existed when this was
-- armed, so props/s7/qr-waste.png and props/s7/qr-podium.png were generated to
-- encode EXACTLY the value below (round-trip verified with a QR decoder, not
-- assumed — scripts/gen-s7-props.mjs). A team that scans either printed code
-- and types what its phone shows matches this value character for character.
--
-- WHAT THE ENGINE COMPARES AGAINST (rules.ts normalizeAnswer):
--   Unicode NFKC  →  every whitespace run collapsed to one space  →  trimmed  →
--   UPPERCASE.  Punctuation and spaces INSIDE the answer are preserved.
--   The payload below is a single ASCII word, so the space/punctuation traps
--   cannot bite at this door. This script applies the same upper/trim/collapse
--   to what you paste, and rejects non-ASCII, so the stored value cannot drift.
--
-- HOW TO RUN: paste the WHOLE file into the Supabase SQL editor (production)
-- or psql (local) and Run. It is safe to re-run: it writes the same value.
--
-- AFTERWARDS: run db/verify-round-2.sql (every arming flag must read false).
-- The catalogue, db/round-2-content.sql and db/verify-round-2.sql already carry
-- this value — if you change it here, change it there too, or the next repair
-- re-introduces the drift this whole guard exists to prevent.
-- =============================================================================

begin;

do $arm$
declare
  -- Payload of both printed QR codes in props/s7/. Re-generate the props with
  -- `node scripts/gen-s7-props.mjs` if this ever changes.
  payload constant text := 'DELETED';

  -- The unfilled-template check is assembled from split literals on purpose: a
  -- find-and-replace of the payload above must not rewrite the comparison it is
  -- tested against, or the script would refuse every real answer forever.
  marker constant text := 'REPLACE' || '_WITH_SCANNED_TEXT';

  cleaned text;
begin
  if payload = marker then
    raise exception 'S7 is still un-armed: put the QR payload in the payload line first.';
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
