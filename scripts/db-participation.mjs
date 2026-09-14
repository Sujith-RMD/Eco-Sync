import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const q = async (sql) => (await c.query(sql)).rows;

console.log(
  "rounds:",
  JSON.stringify(await q("select code, status, duration_minutes from rounds order by code")),
);
console.log(
  "participants per round:",
  JSON.stringify(
    await q(
      "select r.code, count(rp.id) as participants from rounds r left join round_participations rp on rp.round_id = r.id group by r.code order by r.code",
    ),
  ),
);
await c.end();
