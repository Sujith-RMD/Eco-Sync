# P0 pre-event runbook — ECO-SYNC: THE BREACH

Ordered procedure for the six production blockers. Everything here is written to be
run by an operator with a laptop and a phone, in a room, under time pressure.

**Why the database steps happen in the Supabase dashboard, not from this laptop:**
Vercel stores this project's Postgres credentials as *Sensitive* environment
variables. Sensitive values are withheld from `vercel env pull` **and** from
`vercel env run`, so no tool on this machine can open a production connection. The
dashboard already has the credentials, which also removes the risk of pasting a
local connection string into a production repair. (Measured earlier: a probe aimed
at "production" silently reached `127.0.0.1` instead — that is how this kind of
mistake looks, and it is why `db/verify-round-2.sql` is run where the credentials
cannot be confused.)

---

## 0. State as verified today

| Fact | Evidence |
| --- | --- |
| Production URL | `https://eco-sync-mu.vercel.app` (the short `eco-sync.vercel.app` belongs to a **different tenant** — never print it; a team typing it lands on a stranger's login page) |
| App is up and reaches its database | `GET /api/health` → `200 {"ok":true,"db":{"status":"up","latencyMs":35}}` |
| The redesigned participant UI is **already deployed** | `GET /team/round-1/storyline` → 307 → `/login` (route exists; a 404 would mean undeployed) |
| Leaderboard lockdown is **live** | `GET /leaderboard` → 307 → `/login` |
| Public standings feed is gone from production | `GET /api/leaderboard` → 404 |
| **Local** `app_db` (`127.0.0.1:5432`) Round 2 | ✅ 8/8 rows match the supplied questions, chain contiguous 1–8, 850 points, one `FINAL_CODE`, `puzzles_needing_arming = 0` |
| Supabase project `ijsndlhcaxpzhugtoxnk` Round 2 | ✅ identical 8/8 result and identical `round_1_fingerprint` |
| Which database the **deployed** site reads | **unconfirmed** — see §0a |

---

## 0a. Which database are you connected to? Read this before any write

Three Postgres endpoints are in play, and until this run two of them held **different
content revisions**. A repair applied to the wrong one reports success and changes
nothing — which is exactly how `1 link un-armed: S7 (#6/8)` survived being "fixed".

| Endpoint | What it is | Round 2 content |
| --- | --- | --- |
| `127.0.0.1:5432/app_db` | local dev / rehearsal, from `.env` | supplied 8-row chain, armed |
| Supabase `ijsndlhcaxpzhugtoxnk` | the project the pasted Vercel env dump names | supplied 8-row chain, armed |
| whatever the **deployed** site reads | unconfirmed | — |

Both known endpoints now agree, so the un-armed warning is gone from both. But the
deployed site reaches a database identified only by Vercel's own server-side Postgres
variable — and `DATABASE_URL` **wins over** `DATABASE_POSTGRES_URL` (§7b). If Vercel
carries a plain `DATABASE_URL` aimed at a third project, that project is the one that
still needs arming.

**Identify before you write.** Paste `db/identify-content-revision.sql` (read-only) into
the SQL editor of whichever project you are about to touch. It prints the database name,
both puzzle counts, the full Round 2 chain with answer lengths and placeholder flags, the
play-data counts, and a verdict — `SUPPLIED revision — db/arm-s7.sql is safe here` or
`RETIRED revision — do NOT run db/arm-s7.sql here`.

That warning is not theoretical. `db/arm-s7.sql` matches on `code = 'S7'` with **no
`order_index` constraint**, and none of its guards inspect the *old* value — they validate
only the new payload. On the supplied revision `S7` is the QR puzzle at position 6 and the
script is correct. On the retired 11-row revision `S7` was `WATER DATA — IV` at position 9,
and the same script would have silently overwritten a real puzzle's answer.

The same trap is why `db/verify-round-2.sql` is the right first command: it compares
against the supplied questions, so on the wrong revision it says so instead of agreeing
with itself.

---

## 1. Three content questions to settle first (5 minutes, unblocks step 6)

1. **What exactly do the two QR codes reveal?** The scanned text *is* S7's answer.
   Nobody can type what they cannot see, so this must come from the props, not memory.
2. **Does the final link expect only the code, or code + culprit name?** The briefing
   tells teams to "return here with the code and the culprit's name", while the stored
   answer for `LAST` is a single token. If teams are meant to type both, the stored
   answer is wrong and every room fails the last door. Pick one and make the prop, the
   briefing and the stored answer agree.
3. **Is the roster's culprit still the same suspect?** The vote rows, the printed
   answer key and the admin roster must name the same person.

---

## 2. Snapshot before touching anything

Run `db/verify-round-2.sql` (dashboard → SQL Editor → paste → Run) **before** any
repair and keep the output. Two numbers matter:

* `round_1_fingerprint` — the rollback anchor. It must read identically after every
  step below. If it moves, something touched Round 1 and the event is now
  half-repaired; stop and investigate rather than continuing.
* `round_2_attempts` / `round_2_progress_rows` — if these are non-zero, the content
  replacement in step 5 will **refuse** to run, and you need step 5's decision first.

---

## 3. Verify what production actually holds

Same file, already run in step 2. Read the fifth result tab's verdict line:

* `ROUND 2 CONTENT MATCHES THE SUPPLIED QUESTIONS` → production is already correct.
  Skip step 5; do not re-apply anything. Verification, not re-application, is the goal.
* `ROUND 2 CONTENT IS WRONG — apply db/round-2-content.sql` → continue to step 5.
* Eight rows you do not recognise, or a count that is not 8 → the deployment you are
  connected to is not the one you think. Confirm the project reference in the
  dashboard's own header before running anything that writes, and see §0a — a mismatch
  here is how the wrong database gets repaired.

---

## 4. Confirm the guard that now protects you

`startRound` now audits the round's own answers before it flips the status. A round
whose chain contains a placeholder answer — or no puzzles at all — **cannot be
opened**, and the refusal is written to `audit_logs` as `round.start.blocked`. The
command deck also shows the state on arrival, in the Round 02 panel
(`1 link un-armed: S7 (#6/8)`), so the operator learns it before clicking, not after.

This is the shipped behaviour from this changeset: an un-armed Round 2 used to be
reachable by one confident click.

---

## 5. Apply the authoritative Round 2 content

Paste `db/round-2-content.sql` into the SQL editor and Run. It is transactional
(all eight rows or none), idempotent (replacing the puzzle rows), and scoped to
`ROUND_2` — it never touches Round 1.

**If it aborts because Round 2 already has play data:** do not hand-delete rows.
Attempt rows reference puzzle rows, so ad-hoc deletes either fail on a foreign key or
silently orphan the custody log you need for a tie-break. Use the command deck's
purge/restart path, which knows the dependency order, and accept that the teams
involved lose their Round 2 progress — which is exactly why the guard exists.

Then re-run `db/verify-round-2.sql` and expect, precisely:

* all 8 rows `ok = t`, `answers_wrong = 0`, `all_match = t`, verdict `MATCHES`
* `chain_contiguous = t`, `puzzles = 8`, `total_points = 850`
* `final_code_puzzles = 1`, `last_puzzle_code = LAST`
* `puzzles_needing_arming = 0` ← S7 is seeded armed (`DELETED`); a `1` here means the
  database is on the pre-arming revision of this file and step 6 still applies
* `round_1_fingerprint` **unchanged** from step 2

---

## 6. Arm S7 — the physical and the digital meeting point ✅ RESOLVED

**Status: done.** S7 is armed with `DELETED`, and the props were *generated from that
value* rather than scanned from it — no QR codes existed, so the direction of truth was
reversed: the answer is authored, and the codes are produced to match it.

| Item | Value |
| --- | --- |
| Payload | `DELETED` (7 characters, single ASCII word) |
| Props | `props/s7/qr-waste.png`, `props/s7/qr-podium.png` — generated by `scripts/gen-s7-props.mjs` |
| Print sheet | `props/s7/S7-PRINT.html` — built by `scripts/gen-s7-sheet.mjs`, both codes embedded as base64 |
| Round-trip proof | `gen-s7-props.mjs` decodes each PNG with `jsqr` and throws unless it byte-equals the payload — verified, not assumed |
| Armed in | the live row (`db/arm-s7.sql`), `db/round-2-content.sql`, `db/verify-round-2.sql`, `src/server/game/catalogue.ts` |

Print `props/s7/S7-PRINT.html`, cut along the dashes, tape one code near the waste and
the other near the podium, and keep the sheet away from players. Because the payload is
a single ASCII word with no spaces or punctuation, the S3/S8 colon trap and the S4
two-word trap cannot bite at this door.

**A note on the props, for whoever cuts them:** both PNGs are byte-identical (same
`md5`), because both encode the same token. That is deliberate — the briefing says
"find and scan both", and either one reveals the same word. It also means a team that
finds only *one* code has the answer. If the two locations are meant to be independently
necessary, the codes need different payloads and the briefing needs to say how they
combine; that is a design decision, not a repair.

**If the payload ever changes**, four places must move together or door six re-seals for
every room behind it:

1. `db/arm-s7.sql` — the `payload` line, then Run it against the live database;
2. `node scripts/gen-s7-props.mjs` (rewrites both PNGs and re-proves the round-trip),
   then `node scripts/gen-s7-sheet.mjs` and re-print;
3. `src/server/game/catalogue.ts` and `db/round-2-content.sql` — the seeded answer;
4. `db/verify-round-2.sql` — the expected value, or it reports a false `ok_answer = f`.

Then run `npx vitest run`, `npx tsc --noEmit`, `npx eslint src tests`.

The engine-side rationale is unchanged and worth keeping: the arming script applies the
same transform the engine applies (trim → collapse internal whitespace runs to one space
→ uppercase) and rejects non-ASCII, so a typographic quote pasted from a document fails
loudly there instead of silently stranding the door later. `normalizeAnswer` also applies
NFKC, which plain SQL cannot — hence ASCII only. No value is printed in the script's
output, because an operator console is a shoulder-surfed surface in a room full of teams.

---

## 7. Credentials and pooling

### 7a. Rotate so the exposed values stop working

The exposed set is the Supabase **service-role key**, the **JWT secret**, the
**`postgres` database password**, and the pattern `sujith@201207`.

* **Service-role key + JWT secret — the app never reads them.** Verified by search:
  nothing under `src/` references `SUPABASE_*` except our own TLS trust module, which
  only pattern-matches the hostname. Supabase's Auth product is not used either; a
  session here is an opaque random token row in the `sessions` table. So rotating them
  invalidates nothing the game depends on, and **no participant or admin is logged
  out.** Rotate in Supabase (Dashboard → Project Settings → Data API → JWT Secret;
  API Keys → rotate the legacy service key, which invalidates the old one), then remove
  the now-unused items from Vercel so they cannot leak again:
  `vercel env rm DATABASE_SUPABASE_URL production -y` (repeat per unused item).
  Removing them is the larger win: fewer live secrets in the project.
* **The database password does matter** — it is in the connection string. Order, to
  avoid a self-inflicted outage: rotate in Supabase → immediately update the Vercel
  items → redeploy (new function instances pick up the new value; *Sensitive* items
  cannot be edited in place, so delete and re-add, then deploy) → confirm
  `GET /api/health` reports `db.status: "up"`. Anything still holding the old value
  fails auth, which is the point of rotating: the old credential stops working.
* Update **both** `DATABASE_POSTGRES_URL` (pooled) and `DATABASE_POSTGRES_URL_NON_POOLING`
  (direct), or a future code path that reads the other name breaks at the worst moment.
* `ADMIN201207` is kept deliberately, per your decision.

### 7b. Pooling

* Code side is done here: pool `max` **10 → 3**, plus `connectionTimeoutMillis: 10s` so
  a starved request fails honestly (and `/api/health` says `db: "down"`) instead of
  hanging until the platform kills the function. On serverless, each concurrent
  instance opens its own pool, so 10 × the instances 60 units can summon at submit-time
  is how a game hits Supabase's connection ceiling mid-round.
* Supabase → Project Settings → Database → **Connection Pooling**: use **Transaction**
  mode (port `6543`), not Session, for the app URL. The pooler's username is
  `postgres.<PROJECT_REF>`, not plain `postgres` — copying the direct-connect string and
  changing only the host is the classic 28P01.
* This codebase is transaction-pooler safe, verified rather than assumed: no `SET LOCAL`,
  no advisory locks, no `LISTEN`/`NOTIFY`, no named prepared statements, and every
  `db.transaction()` opens and commits within one call — which is what PgBouncer pins a
  server connection for.
* **`DATABASE_URL` wins over `DATABASE_POSTGRES_URL`** (deliberate, for local `.env`
  override). So do not leave both set to different endpoints in production: if you add
  `DATABASE_URL`, make it the transaction-pooler URL, or delete it.

---

## 8. Deploy this changeset (after steps 5–7)

```
git add -A
git commit -m "Fail closed on un-armed content; cap the serverless pool"
git push
```

Vercel auto-deploys `main`; if it has not, `npx vercel deploy --prod`. Then re-probe the
four claims: `/api/health` → `db up`; `/leaderboard` → `/login`; `/api/leaderboard` → 404;
`/team/round-2/suspects` → `/login` when logged out.

Proof the guard works, in order: with S7 un-armed, the deck shows the un-armed warning
and "Open Round 02" is refused with the link named; after arming, it opens.

---

## 9. Physical props ↔ digital answers: one system

The expected values live in `src/server/game/catalogue.ts` and in
`db/round-2-content.sql`. Read them there — this sheet deliberately prints no answers,
so it can be handed to a volunteer.

How the engine decides (`normalizeAnswer` in `src/server/game/rules.ts`): NFKC → every
run of whitespace collapses to one space → trimmed → uppercased. **Punctuation inside
the answer is preserved, and matching is exact.** No partial credit; each wrong
submission is written to the custody log, costs points and can burn a hint.

| Link | Prop to check | What must be true | Trap that fails a whole room |
| --- | --- | --- | --- |
| S1 | Crumpled draft in the room | Physically findable by a team that looks; its defaced figure reads as the one-word answer | A prop that falls behind a cabinet, or a word only legible under torch |
| S3 | Judging schedule | The start time is printed unambiguously | Answer is four digits **with no colon**; `02:15` is *not* `0215`, and the phone keyboard offers the colon |
| S4 | Newspaper **page 4** crossword | First letters, in hint order, spell one run-together word | Teams type it as two words — a space is kept and the answer fails |
| S5 | Newspaper **page 2** highlighted letters | Highlighting survives printing (pencil/toner contrast) and the letters are in a fixed reading order | Ambiguous reading order → many wrong answers, all defensible |
| S6 | Newspaper **page 2** fill-in-the-blanks | Blanks resolve to a single revealed word | Same word appearing in the body text as well, giving two readings |
| S7 | **Two** QR codes, near "waste" and "podium" | Both scan on a phone camera at the printed size, in the lighting you will have | One code damaged or out of focus = door 6 and everything behind it; also: paste the payload, **then re-type it** — documents silently substitute typographic quotes |
| S8 | Gate log | The car row is readable and the matching statement is available to cross-reference | Four digits again, colon trap identical to S3 |
| LAST | Amphitheatre / open-air backup | The code is reachable by 15 units at once, readable, and **equals the stored answer** | The stored answer is a single token while the briefing asks for "the code and the culprit's name" — settle this in step 1 before doors open |
| Vote | Suspect roster (printed + admin) | Same five names in both; one irreversible verdict per unit (a unique index enforces one row per team, so a mis-tap cannot be corrected in-app) | Any printed key that names the culprit differently |

Two format items worth deciding now, since both are cheap before doors open and
expensive during play:

* The two time briefings already print `(HHMM)`. Adding **"no colon"** to that line is
  the single highest-yield copy change available. It changes briefing text, so it must be
  mirrored in **all three** places (`catalogue.ts`, `round-2-content.sql`,
  `verify-round-2.sql`) — the verifier compares briefings byte-exactly and will report
  `briefings_wrong` if one is missed.
* Every Round 2 puzzle has `hints: []`, so the hint control renders inert on every link.
  Either seed real hints or drop the control for this round; an unusable button on a
  mobile screen reads as a bug to a team under time pressure.

The chain is positional, so numbering that skips (`S1` then `S3`) is harmless to the
engine — it unseals `order_index + 1`, not the next code alphabetically — but confirm the
skip is deliberate storytelling rather than a missing row: the verifier's
`chain_contiguous = t` proves the positions are unbroken either way.

---

## 10. Rehearse from an actual phone, as a real unit

**Use a test unit, and do this last.** A single correct rehearsal submission writes
Round 2 play data, and step 5's guard will then refuse any further content replacement.
Rehearsing after the final content state avoids needing a repair you can no longer apply.

Log in with an issued access code and walk the spec:

* Three tabs, in order: **Storyline, Answers, Suspects** — icons plus labels, active tab
  unmistakable, thumb-height fixed bar, and the submit button still reachable above it.
* Nothing leaderboard-shaped is reachable: as a participant, `/leaderboard` returns you to
  `/login`. It is a redirect at the route, not a hidden element.
* Answers tab is the working surface: validation intact, no answer text hinted anywhere.
* Locked links show **no title, no briefing, no preview** — the sealed count only.
* Submit a **wrong** answer: no notification, and the badge does not move.
* Submit the **correct** answer: one "STORYLINE UPDATED / New case information has been
  unlocked." notice, directing attention to the Storyline tab; it dismisses itself in
  ~9 s or on the ✕; opening the case file clears the badge; a second unlock **re-arms**
  the notice rather than stacking a second copy; a refresh does not resurrect a read
  notice.
* Case file reads as a chronology: round opened → briefing per link → each broken link
  with its penalty/hint notes only when they really happened → nothing about the future.
* Suspects tab is the case board, not a dashboard: dossier list, your unit's sealed
  verdict highlighted, and the vote with its irreversibility warning.
* Widths 320 / 375 / 390 / 430 px: no horizontal scroll, no clipped tab labels, tap
  targets ≥ 44 px. On desktop the layout should re-orient (top bar, wider reading
  column), not stretch the phone view.

Then, from the organizer's side only: confirm the board still shows real standings for
the same round the participants cannot see.

---

## 11. Blocked on you

1. ~~The S7 payload — the decoded text of the two printed QR codes (step 6).~~
   **Resolved:** armed with `DELETED`, and the props were generated from that value
   rather than scanned from it (`props/s7/`, `scripts/gen-s7-props.mjs`). See step 6.
   One design question remains open and is *not* a blocker: both printed codes are
   byte-identical, so finding either one yields the answer.
2. Whether `LAST` expects the bare code or code + name, and which prop carries it (step 1).
3. Whether the roster's culprit is still the same suspect across props, admin and DB.
4. Approval to add "no colon" to the two time briefings, and a decision on the inert hint
   control (step 9).
5. Confirmation that rotating the service-role key and JWT secret is wanted *now* —
   they are unused by the app, so removing them from the project is safe and reduces
   what can leak again (step 7a).
6. **Which Supabase project the deployed site actually reads** (§0a). Both endpoints we
   can reach are correct as of this run, but if Vercel carries a plain `DATABASE_URL`
   aimed at a third project, that one is still un-armed and the deck will refuse to open
   Round 02. One paste of `db/identify-content-revision.sql` into the right dashboard
   settles it in seconds.
