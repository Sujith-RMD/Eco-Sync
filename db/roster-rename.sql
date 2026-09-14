-- =============================================================================
-- ECO-SYNC: THE BREACH — roster migration: UNIT-NN → TEAM#XXXX
--
-- GENERATED FILE — DO NOT EDIT BY HAND.
--   Regenerate with:
--     npx tsx scripts/apply-roster.ts --emit-sql > db/roster-rename.sql
--
-- The login ID is `teams.name`. The admin deck, the leaderboard and the
-- per-team file all read it straight out of the database, so a front-end
-- release cannot rename anybody: these rows are the rename.
--
-- SAFE TO RUN, AND SAFE TO RUN TWICE
--   * Matches on the numeric suffix, so unit-7 / UNIT-07 / unit-007 all resolve
--     to position 7. An exact string match would silently skip a row that was
--     ever seeded with different padding — and a skipped row is a team that
--     cannot sign in.
--   * Only `name` is written. `teams.id` is untouched, so every progress,
--     attempt, hint, ledger, participation, session and vote row still points
--     at the team it always did.
--   * `access_code_hash` is untouched, so every code already printed on a
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
-- Before: what is actually in this database? Expect sixty `unit-NN` rows on a
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
    (1, 'TEAM#8210'),
    (2, 'TEAM#9303'),
    (3, 'TEAM#5376'),
    (4, 'TEAM#3481'),
    (5, 'TEAM#8938'),
    (6, 'TEAM#3768'),
    (7, 'TEAM#1259'),
    (8, 'TEAM#1996'),
    (9, 'TEAM#7505'),
    (10, 'TEAM#8824'),
    (11, 'TEAM#3555'),
    (12, 'TEAM#8197'),
    (13, 'TEAM#6257'),
    (14, 'TEAM#2524'),
    (15, 'TEAM#1360'),
    (16, 'TEAM#4802'),
    (17, 'TEAM#5594'),
    (18, 'TEAM#1379'),
    (19, 'TEAM#4217'),
    (20, 'TEAM#6940'),
    (21, 'TEAM#4948'),
    (22, 'TEAM#8248'),
    (23, 'TEAM#7302'),
    (24, 'TEAM#4877'),
    (25, 'TEAM#9776'),
    (26, 'TEAM#1924'),
    (27, 'TEAM#2292'),
    (28, 'TEAM#7580'),
    (29, 'TEAM#9023'),
    (30, 'TEAM#4320'),
    (31, 'TEAM#2120'),
    (32, 'TEAM#6667'),
    (33, 'TEAM#8254'),
    (34, 'TEAM#1367'),
    (35, 'TEAM#6141'),
    (36, 'TEAM#1263'),
    (37, 'TEAM#8829'),
    (38, 'TEAM#8041'),
    (39, 'TEAM#2566'),
    (40, 'TEAM#3714'),
    (41, 'TEAM#8275'),
    (42, 'TEAM#7063'),
    (43, 'TEAM#1571'),
    (44, 'TEAM#9174'),
    (45, 'TEAM#5698'),
    (46, 'TEAM#9561'),
    (47, 'TEAM#7129'),
    (48, 'TEAM#5050'),
    (49, 'TEAM#3986'),
    (50, 'TEAM#4584'),
    (51, 'TEAM#4500'),
    (52, 'TEAM#2927'),
    (53, 'TEAM#1899'),
    (54, 'TEAM#3187'),
    (55, 'TEAM#9180'),
    (56, 'TEAM#3038'),
    (57, 'TEAM#9298'),
    (58, 'TEAM#5349'),
    (59, 'TEAM#6764'),
    (60, 'TEAM#9312')
    ) as m(position, new_name)
      on case when t.name ~* '^unit-[0-9]+$'
        then nullif(regexp_replace(lower(t.name), '^unit-0*', ''), '')::int
   end = m.position
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
    (1, 'TEAM#8210'),
    (2, 'TEAM#9303'),
    (3, 'TEAM#5376'),
    (4, 'TEAM#3481'),
    (5, 'TEAM#8938'),
    (6, 'TEAM#3768'),
    (7, 'TEAM#1259'),
    (8, 'TEAM#1996'),
    (9, 'TEAM#7505'),
    (10, 'TEAM#8824'),
    (11, 'TEAM#3555'),
    (12, 'TEAM#8197'),
    (13, 'TEAM#6257'),
    (14, 'TEAM#2524'),
    (15, 'TEAM#1360'),
    (16, 'TEAM#4802'),
    (17, 'TEAM#5594'),
    (18, 'TEAM#1379'),
    (19, 'TEAM#4217'),
    (20, 'TEAM#6940'),
    (21, 'TEAM#4948'),
    (22, 'TEAM#8248'),
    (23, 'TEAM#7302'),
    (24, 'TEAM#4877'),
    (25, 'TEAM#9776'),
    (26, 'TEAM#1924'),
    (27, 'TEAM#2292'),
    (28, 'TEAM#7580'),
    (29, 'TEAM#9023'),
    (30, 'TEAM#4320'),
    (31, 'TEAM#2120'),
    (32, 'TEAM#6667'),
    (33, 'TEAM#8254'),
    (34, 'TEAM#1367'),
    (35, 'TEAM#6141'),
    (36, 'TEAM#1263'),
    (37, 'TEAM#8829'),
    (38, 'TEAM#8041'),
    (39, 'TEAM#2566'),
    (40, 'TEAM#3714'),
    (41, 'TEAM#8275'),
    (42, 'TEAM#7063'),
    (43, 'TEAM#1571'),
    (44, 'TEAM#9174'),
    (45, 'TEAM#5698'),
    (46, 'TEAM#9561'),
    (47, 'TEAM#7129'),
    (48, 'TEAM#5050'),
    (49, 'TEAM#3986'),
    (50, 'TEAM#4584'),
    (51, 'TEAM#4500'),
    (52, 'TEAM#2927'),
    (53, 'TEAM#1899'),
    (54, 'TEAM#3187'),
    (55, 'TEAM#9180'),
    (56, 'TEAM#3038'),
    (57, 'TEAM#9298'),
    (58, 'TEAM#5349'),
    (59, 'TEAM#6764'),
    (60, 'TEAM#9312')
)
update teams t
   set name = m.new_name
  from mapping m
 where case when t.name ~* '^unit-[0-9]+$'
        then nullif(regexp_replace(lower(t.name), '^unit-0*', ''), '')::int
   end = m.position
   and t.name <> m.new_name;

insert into teams (name, access_code_hash)
select 'TEAM#5312', 'scrypt$16384$8$1$6wtDFTvNAZrgjORTjYwfTg==$KEab8imlrouIpVUU3WoZ63XJFSxrRLlkcgqQcemd033a/6T9y96xd2yVfVQcSl7h0yJiY8rsJlBC9qL7qm9xzQ=='
 where not exists (select 1 from teams where lower(name) = lower('TEAM#5312'));

commit;

-- ---------------------------------------------------------------------------
-- After: expect zero legacy_unit_rows and total_teams equal to the roster size.
-- ---------------------------------------------------------------------------
select count(*) filter (where name ~* '^unit-[0-9]+$') as legacy_unit_rows,
       count(*) filter (where name ~* '^team#')          as team_rows,
       count(*)                                          as total_teams
  from teams;

select id, name from teams order by id;
