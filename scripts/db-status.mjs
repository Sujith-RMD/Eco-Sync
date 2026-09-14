// Read-only probe: what does the live local database say about Round 2?
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
console.log("target host:", new URL(url).host, "db:", new URL(url).pathname);

const client = new pg.Client({ connectionString: url });
await client.connect();

const rounds = await client.query(
  "select code, status, started_at, ended_at from rounds order by code",
);
console.table(rounds.rows);

const s7 = await client.query(
  `select p.code, p.order_index, p.kind, p.expected_answer_normalized
     from puzzles p join rounds r on r.id = p.round_id
    where r.code = 'ROUND_2' and p.code = 'S7'`,
);
console.log("S7 row:", JSON.stringify(s7.rows));

const unarmed = await client.query(
  `select p.code, p.order_index
     from puzzles p join rounds r on r.id = p.round_id
    where r.code = 'ROUND_2' and p.expected_answer_normalized ~ '^__[A-Z0-9_-]+__$'
    order by p.order_index`,
);
console.log("un-armed links:", JSON.stringify(unarmed.rows));

const play = await client.query(
  `select
     (select count(*) from puzzle_attempts pa join puzzles p on p.id=pa.puzzle_id join rounds r on r.id=p.round_id where r.code='ROUND_2') as r2_attempts,
     (select count(*) from team_puzzle_progress tpp join puzzles p on p.id=tpp.puzzle_id join rounds r on r.id=p.round_id where r.code='ROUND_2') as r2_progress,
     (select count(*) from hint_usages hu join puzzles p on p.id=hu.puzzle_id join rounds r on r.id=p.round_id where r.code='ROUND_2') as r2_hints,
     (select count(*) from culprit_votes) as votes,
     (select count(*) from teams) as teams`,
);
console.log("play data:", JSON.stringify(play.rows[0]));

await client.end();
