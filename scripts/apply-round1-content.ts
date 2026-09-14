/**
 * Applies the Round 1 catalogue to a live database.
 *
 *   CONFIRM_CONTENT=yes NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/apply-round1-content.ts
 *
 *   # or, to get SQL you can paste into the Supabase SQL editor:
 *   npx tsx scripts/apply-round1-content.ts --emit-sql > db/round-1-content.sql
 *
 * Round 1 grew from 7 links to 10 (P7 RECOVERED TRANSMISSION was inserted at
 * position 7, pushing PACKET CAPTURE, SYSTEM LOG and THE CASE CODE behind it).
 * A deployment does not re-seed existing rows — `seedEvent` refuses to run once
 * `rounds` has a ROUND_1 row — so the change has to be written to each database
 * that serves the game.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN .sql. `db/round-2-content.sql`
 * carries its own copy of the eight questions, and `db/arm-s7.sql` opens with a
 * warning about exactly what that costs: two copies that drift, and a repair
 * that re-introduces the drift. This reads `ROUND1_PUZZLES` instead and
 * normalizes through the engine's own `normalizeAnswer`, so the database cannot
 * disagree with the code that grades against it. Re-running writes the same
 * rows.
 *
 * `--emit-sql` exists for the same reason, not in spite of it. Most of the
 * event's databases are reached by pasting SQL into the Supabase editor, and
 * the alternative — a hand-maintained .sql beside this script — is the drift
 * this header is about. So the SQL is *generated* from the same catalogue and
 * the same normalizer, and `db/round-1-content.sql` is a build artifact to be
 * regenerated, never edited.
 *
 * Point it at whatever `DATABASE_URL` names — local Postgres or Supabase. It
 * prints the target host before doing anything, and refuses without the
 * confirmation variable: the same connection string that runs a rehearsal also
 * runs the event.
 */
import "dotenv/config";

import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { puzzles, rounds } from "@/db/schema";
import { ROUND1_PUZZLES } from "@/server/game/catalogue";
import { normalizeAnswer } from "@/server/game/rules";

const ROUND = "ROUND_1";

function targetHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL is not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL is not a parseable URL)";
  }
}

/**
 * Dollar-quoted so briefings can carry newlines, apostrophes and backslashes
 * without escaping. The tag is bumped if the content happens to contain it,
 * which is the only way dollar quoting can be broken.
 */
function sqlLiteral(value: string): string {
  let tag = "$eco$";
  let n = 0;
  while (value.includes(tag)) {
    n += 1;
    tag = `$eco${n}$`;
  }
  return `${tag}${value}${tag}`;
}

/** The same write the live path performs, as SQL, for the Supabase editor. */
function renderSql(): string {
  const ordered = [...ROUND1_PUZZLES].sort((a, b) => a.orderIndex - b.orderIndex);

  const values = ordered
    .map((p) =>
      [
        "    (",
        sqlLiteral(p.code),
        `, ${p.orderIndex}`,
        `, ${sqlLiteral(p.kind)}`,
        `, ${sqlLiteral(p.title)}`,
        `, ${sqlLiteral(p.briefing)}`,
        `, ${sqlLiteral(normalizeAnswer(p.answer))}`,
        `, ${sqlLiteral(JSON.stringify(p.hints))}::jsonb`,
        `, ${p.points}`,
        ")",
      ].join(""),
    )
    .join(",\n");

  return `-- =============================================================================
-- ECO-SYNC: THE BREACH — Round 1 content (${ordered.length} links, P1→P10)
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
      where p.round_id = (select id from rounds where code = '${ROUND}'))
  + (select count(*) from team_puzzle_progress tpp
       join puzzles p on p.id = tpp.puzzle_id
      where p.round_id = (select id from rounds where code = '${ROUND}'))
  + (select count(*) from hint_usages hu
       join puzzles p on p.id = hu.puzzle_id
      where p.round_id = (select id from rounds where code = '${ROUND}'))
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
${values}
) as v(code, order_index, kind, title, briefing, expected_answer_normalized, hints, points)
where r.code = '${ROUND}'
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
-- Verification. Expect ${ordered.length} rows, order_index 1..${ordered.length} with no
-- gaps, no strays, and awaiting_answer = f on every row.
-- ---------------------------------------------------------------------------
select p.order_index, p.code, p.points, p.title,
       p.expected_answer_normalized ~ '^__[A-Z0-9_-]+__$' as awaiting_answer,
       p.expected_answer_normalized = '' as blank_answer,
       jsonb_array_length(p.hints) as hints
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = '${ROUND}'
 order by p.order_index;

select count(*) as rows,
       min(order_index) as first_index,
       max(order_index) as last_index,
       count(distinct order_index) as distinct_indexes
  from puzzles p
  join rounds r on r.id = p.round_id
 where r.code = '${ROUND}';
`;
}

async function main() {
  if (process.argv.includes("--emit-sql")) {
    process.stdout.write(renderSql());
    return;
  }

  console.log("— apply Round 1 content —");
  console.log(`  target: ${targetHost()}`);

  if (process.env.CONFIRM_CONTENT !== "yes") {
    console.error(
      "\n  ✗ Refusing to write without confirmation.\n" +
        "    Re-run with CONFIRM_CONTENT=yes once the target above is the\n" +
        "    database you actually mean.\n",
    );
    process.exitCode = 1;
    return;
  }

  /*
    Same guard as the emitted SQL: a round that has been played must not have its
    chain rewritten underneath the teams that played it. `order_index` is what the
    unlock chain keys on, so moving it mid-round strands every later link and the
    case code never unseals.
  */
  const guard = await db.execute(sql`
    select
      (select count(*) from puzzle_attempts pa
         join puzzles p on p.id = pa.puzzle_id
        where p.round_id = (select id from rounds where code = ${ROUND}))::int as attempts,
      (select count(*) from team_puzzle_progress tpp
         join puzzles p on p.id = tpp.puzzle_id
        where p.round_id = (select id from rounds where code = ${ROUND}))::int as progress,
      (select count(*) from hint_usages hu
         join puzzles p on p.id = hu.puzzle_id
        where p.round_id = (select id from rounds where code = ${ROUND}))::int as hints
  `);
  const play = guard.rows[0] as { attempts: number; progress: number; hints: number };
  const referencing = play.attempts + play.progress + play.hints;

  if (referencing > 0) {
    console.error(
      `\n  ✗ Refusing to rewrite Round 1: ${referencing} rows of play data ` +
        `reference its puzzles ` +
        `(attempts ${play.attempts}, progress ${play.progress}, hints ${play.hints}).\n` +
        "    RESTART the round first, or repair the affected teams individually\n" +
        "    from /admin/teams/[id] instead.\n",
    );
    process.exitCode = 1;
    return;
  }

  const ordered = [...ROUND1_PUZZLES].sort((a, b) => a.orderIndex - b.orderIndex);

  await db.transaction(async (tx) => {
    const [round] = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.code, ROUND));
    if (!round) throw new Error(`ROUND_MISSING: ${ROUND} is not seeded in this database`);

    for (const puzzle of ordered) {
      const row = {
        roundId: round.id,
        code: puzzle.code,
        orderIndex: puzzle.orderIndex,
        kind: puzzle.kind,
        title: puzzle.title,
        briefing: puzzle.briefing,
        // Through the engine's own normalizer, so the stored value and the
        // comparison in rules.ts cannot drift apart. `t179PiWXDnA` is stored
        // as `T179PIWXDNA` — the lowercase video id never reaches the DB.
        expectedAnswerNormalized: normalizeAnswer(puzzle.answer),
        hints: puzzle.hints,
        points: puzzle.points,
      };
      await tx
        .insert(puzzles)
        .values(row)
        .onConflictDoUpdate({ target: [puzzles.roundId, puzzles.code], set: row });
    }
  });

  console.log(`  ✓ wrote ${ordered.length} links`);

  /* verification ---------------------------------------------------------- */

  const rows = await db.execute(sql`
    select p.order_index, p.code, p.points, p.title,
           p.expected_answer_normalized ~ '^__[A-Z0-9_-]+__$' as placeholder,
           p.expected_answer_normalized = '' as blank,
           jsonb_array_length(p.hints) as hints
      from puzzles p
      join rounds r on r.id = p.round_id
     where r.code = ${ROUND}
     order by p.order_index
  `);

  console.table(rows.rows);

  const live = rows.rows as unknown as Array<{
    order_index: number;
    code: string;
    placeholder: boolean;
    blank: boolean;
  }>;
  const expectedCodes = ordered.map((p) => p.code);

  const contiguous = live.every((row, index) => row.order_index === index + 1);
  const strays = live.filter((row) => !expectedCodes.includes(row.code));
  const missing = expectedCodes.filter((code) => !live.some((row) => row.code === code));
  const unarmed = live.filter((row) => row.placeholder || row.blank);

  console.log(`\n  links           ${live.length} (catalogue has ${expectedCodes.length})`);
  console.log(`  contiguous 1..n ${contiguous ? "yes" : "NO"}`);
  console.log(
    `  un-armed        ${unarmed.length === 0 ? "none" : unarmed.map((r) => r.code).join(", ")}`,
  );
  if (strays.length > 0) {
    console.error(
      `\n  ✗ Round 1 holds ${strays.length} link(s) the catalogue does not define: ` +
        `${strays.map((r) => r.code).join(", ")}.\n` +
        "    Nothing was deleted — this database is not the revision this script\n" +
        "    expects. Inspect before proceeding; a stray at position N strands\n" +
        "    every later link, because the chain unseals order_index + 1.\n",
    );
  }
  if (missing.length > 0) {
    console.error(`\n  ✗ missing from Round 1: ${missing.join(", ")}\n`);
  }
  if (unarmed.length > 0) {
    console.error("\n  ✗ a placeholder or blank answer blocks the round from opening.\n");
  }
  if (strays.length > 0 || missing.length > 0 || unarmed.length > 0 || !contiguous) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("apply-round1-content crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
