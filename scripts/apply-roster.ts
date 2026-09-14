/**
 * Migrates a database from the old `UNIT-NN` logins to the real `TEAM#XXXX`
 * designations issued at the check-in desk.
 *
 *   # see what it would do, as SQL you can paste into the Supabase editor:
 *   npx tsx scripts/apply-roster.ts --emit-sql > db/roster-rename.sql
 *
 *   # or apply it directly:
 *   CONFIRM_ROSTER=yes NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/apply-roster.ts
 *
 * WHY THIS IS NEEDED AT ALL. The admin deck's Teams table, the leaderboard and
 * the per-team file all render `teams.name`. That value lives in the database,
 * so no amount of front-end work renames it — a deployed code change will keep
 * showing `UNIT-01` until the rows themselves are rewritten.
 *
 * WHY IT IS SAFE. The update matches on the row's current name and changes only
 * that column. `teams.id` is untouched, so every `team_puzzle_progress`,
 * `puzzle_attempts`, `hint_usages`, `score_events`, `round_participations`,
 * `sessions` and `culprit_votes` row keeps pointing at the team it always did.
 * `access_code_hash` is untouched, so every access code already printed on a
 * slip still works — the whole point of the rename.
 *
 * Matching is on the NUMERIC SUFFIX, not on an exact string, so `unit-7`,
 * `UNIT-07` and `unit-007` all resolve to position 7. Matching the exact
 * literal would silently skip a row that was ever seeded with different
 * padding, and a skipped row is a team that cannot sign in.
 *
 * Re-running is a no-op: once a row is named `TEAM#XXXX` it no longer matches
 * the `unit-` pattern.
 */
import "dotenv/config";

import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { TEAM_ROSTER } from "@/server/game/seed";

/**
 * The legacy database held sixty logins, `UNIT-01`..`UNIT-60`, in sheet order.
 * The roster is longer because AB5-212 was added after the sheet was first
 * transcribed, so the entries past this point have nothing to rename — they
 * have to be inserted.
 */
const LEGACY_COUNT = 60;

const renames = TEAM_ROSTER.slice(0, LEGACY_COUNT).map((name, index) => ({
  position: index + 1,
  newName: name,
}));

const additions = TEAM_ROSTER.slice(LEGACY_COUNT);

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
 * Resolves a team's position from whatever its name looks like now. Written as
 * SQL rather than a string compare so the caller cannot accidentally be
 * case- or padding-sensitive.
 */
const POSITION_OF = (expr: string) =>
  `case when ${expr} ~* '^unit-[0-9]+$'
        then nullif(regexp_replace(lower(${expr}), '^unit-0*', ''), '')::int
   end`;

async function renderSql(): Promise<string> {
  const mapping = renames
    .map((r) => `    (${r.position}, ${literal(r.newName)})`)
    .join(",\n");

  /*
    The extra team needs an access_code_hash, which SQL cannot produce — scrypt
    is not a database function. It is read from whichever database this script
    is pointed at, so the generated file carries the same hash the local
    database already has and the printed slip keeps working.
  */
  let extraBlock = "";
  if (additions.length > 0) {
    // Sixty-one rows; reading them all and matching in JS avoids building a
    // dynamic `in` list, and the table is never large enough for that to cost
    // anything.
    const rows = await db.execute(sql`select name, access_code_hash from teams`);
    const found = rows.rows as unknown as Array<{ name: string; access_code_hash: string }>;

    extraBlock = additions
      .map((name) => {
        const row = found.find((r) => r.name.toLowerCase() === name.toLowerCase());
        if (!row) {
          return `-- ${name}: no access_code_hash found on the source database. Insert it
-- from the admin deck instead, or re-run this generator against a database
-- that has it. Without a hash the team cannot sign in.`;
        }
        return `insert into teams (name, access_code_hash)
select ${literal(name)}, ${literal(row.access_code_hash)}
 where not exists (select 1 from teams where lower(name) = lower(${literal(name)}));`;
      })
      .join("\n\n");
  }

  return `-- =============================================================================
-- ECO-SYNC: THE BREACH — roster migration: UNIT-NN → TEAM#XXXX
--
-- GENERATED FILE — DO NOT EDIT BY HAND.
--   Regenerate with:
--     npx tsx scripts/apply-roster.ts --emit-sql > db/roster-rename.sql
--
-- The login ID is \`teams.name\`. The admin deck, the leaderboard and the
-- per-team file all read it straight out of the database, so a front-end
-- release cannot rename anybody: these rows are the rename.
--
-- SAFE TO RUN, AND SAFE TO RUN TWICE
--   * Matches on the numeric suffix, so unit-7 / UNIT-07 / unit-007 all resolve
--     to position 7. An exact string match would silently skip a row that was
--     ever seeded with different padding — and a skipped row is a team that
--     cannot sign in.
--   * Only \`name\` is written. \`teams.id\` is untouched, so every progress,
--     attempt, hint, ledger, participation, session and vote row still points
--     at the team it always did.
--   * \`access_code_hash\` is untouched, so every code already printed on a
--     check-in slip keeps working.
--   * Re-running is a no-op: a row named TEAM#XXXX no longer matches 'unit-'.
--
-- WHERE TO RUN IT
--   * Supabase: Dashboard -> SQL Editor -> New query, paste, Run.
--   * Local:    psql -h 127.0.0.1 -U postgres -d app_db -f db/roster-rename.sql
--
-- RUN THE DIAGNOSTIC BELOW FIRST and confirm the counts are what you expect.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Before: what is actually in this database? Expect sixty \`unit-NN\` rows on a
-- database seeded before the rename, or zero once this file has been applied.
-- ---------------------------------------------------------------------------
select count(*) filter (where name ~* '^unit-[0-9]+$') as legacy_unit_rows,
       count(*) filter (where name ~* '^team#')          as team_rows,
       count(*)                                          as total_teams
  from teams;

begin;

-- Refuse rather than half-apply: a target name that already exists would abort
-- the update on the unique constraint anyway, and a partial rename is the one
-- outcome that leaves teams unable to sign in.
do $guard$
declare
  clash text;
begin
  select string_agg(t.name, ', ')
    into clash
    from teams t
    join (values
${mapping}
    ) as m(position, new_name)
      on ${POSITION_OF("t.name")} = m.position
   where exists (
     select 1 from teams other
      where lower(other.name) = lower(m.new_name)
        and other.id <> t.id
   );

  if clash is not null then
    raise exception
      'Refusing to rename: target name(s) already taken by another row: %. Rename or delete those first.',
      clash;
  end if;
end
$guard$;

with mapping(position, new_name) as (
  values
${mapping}
)
update teams t
   set name = m.new_name
  from mapping m
 where ${POSITION_OF("t.name")} = m.position
   and t.name <> m.new_name;

${extraBlock}

commit;

-- ---------------------------------------------------------------------------
-- After: expect zero legacy_unit_rows and total_teams equal to the roster size.
-- ---------------------------------------------------------------------------
select count(*) filter (where name ~* '^unit-[0-9]+$') as legacy_unit_rows,
       count(*) filter (where name ~* '^team#')          as team_rows,
       count(*)                                          as total_teams
  from teams;

select id, name from teams order by id;
`;
}

/** Single-quoted, with the only character that can break it doubled. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  if (process.argv.includes("--emit-sql")) {
    process.stdout.write(await renderSql());
    return;
  }

  console.log("— apply roster (UNIT-NN → TEAM#XXXX) —");
  console.log(`  target: ${targetHost()}`);

  if (process.env.CONFIRM_ROSTER !== "yes") {
    console.error(
      "\n  ✗ Refusing to write without confirmation.\n" +
        "    Re-run with CONFIRM_ROSTER=yes once the target above is the\n" +
        "    database you actually mean.\n",
    );
    process.exitCode = 1;
    return;
  }

  const before = await db.execute(sql`
    select count(*) filter (where name ~* '^unit-[0-9]+$')::int as legacy,
           count(*) filter (where name ~* '^team#')::int          as renamed,
           count(*)::int                                          as total
      from teams
  `);
  console.log("  before:", JSON.stringify(before.rows[0]));

  const active = await db.execute(sql`
    select count(*)::int as n from rounds where status = 'ACTIVE'
  `);
  if ((active.rows[0] as { n: number }).n > 0) {
    console.error(
      "\n  ✗ A round is ACTIVE. Renaming logins mid-round breaks every team\n" +
        "    trying to sign back in. End the round first.\n",
    );
    process.exitCode = 1;
    return;
  }

  await db.transaction(async (tx) => {
    for (const { position, newName } of renames) {
      await tx.execute(sql`
        update teams
           set name = ${newName}
         where case when name ~* '^unit-[0-9]+$'
                    then nullif(regexp_replace(lower(name), '^unit-0*', ''), '')::int
               end = ${position}
           and name <> ${newName}
      `);
    }

    for (const name of additions) {
      const source = await tx.execute(sql`
        select access_code_hash from teams where lower(name) = lower(${name})
      `);
      const hash = (source.rows[0] as { access_code_hash?: string } | undefined)
        ?.access_code_hash;
      if (!hash) {
        console.warn(`  ! ${name}: no access_code_hash on this database — skipped`);
        continue;
      }
      await tx.execute(sql`
        insert into teams (name, access_code_hash)
        select ${name}, ${hash}
         where not exists (select 1 from teams where lower(name) = lower(${name}))
      `);
    }
  });

  const after = await db.execute(sql`
    select count(*) filter (where name ~* '^unit-[0-9]+$')::int as legacy,
           count(*) filter (where name ~* '^team#')::int          as renamed,
           count(*)::int                                          as total
      from teams
  `);
  console.log("  after: ", JSON.stringify(after.rows[0]));

  const rows = await db.execute(sql`select id, name from teams order by id`);
  console.table(rows.rows);

  const summary = after.rows[0] as { legacy: number; renamed: number; total: number };
  if (summary.legacy > 0) {
    console.error(`\n  ✗ ${summary.legacy} row(s) still named unit-NN.\n`);
    process.exitCode = 1;
  }
  if (summary.total !== TEAM_ROSTER.length) {
    console.error(
      `\n  ✗ ${summary.total} teams, but the roster defines ${TEAM_ROSTER.length}.\n`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("apply-roster crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
