# Tests

**80 tests across 8 files.** They run on **Vitest** with no React rendering and
no database — every rule under test is a pure function, which is the point: the
rules that decide a score, a tie-break or whether a round may open are the rules
under test.

```bash
npx vitest run
```

| Suite | Covers |
| --- | --- |
| `tests/engine/rules.test.ts` | Answer normalization (case, whitespace, and the permissiveness guard that stops `3 048` becoming `3048`), the two-attempt grace period then −25 per wrong answer to the −50 per-puzzle cap, the hint cost constant, +2 per full minute, the 1055 Round 1 maximum, a simulated full run, qualification ordering and tie-breaks, Round 2 winner ordering |
| `tests/engine/catalogue.test.ts` | Round 1 chain integrity (P1→P10, contiguous `order_index`, difficulty-tiered points with the 150-point case code, every link armed and hinted), Round 2 play order (S1, S3…S8, `LAST`) with contiguous `order_index`, the *absence* of the retired envelope/water-data chain, answer shapes as pinned by the supplied documents, the 150-point final-code capstone, suspect roster validity and strict suspect codes |
| `tests/engine/content-guard.test.ts` | Placeholder recognition (`__LIKE_THIS__` in any casing, including markers it has never seen), the operator-facing refusal message and the blast radius it states, and the armed state of both catalogues — Round 1 fully armed, Round 2 fully armed once S7's QR payload was authored |
| `tests/db/connection-config.test.ts` | Supabase TLS pinning, `sslmode` removal without leaving dangling punctuation, every other host left untouched, unparseable values surviving module load |
| `tests/lib/event-time.test.ts` | IST display formatting: the +05:30 offset, the calendar day rolling when UTC is behind, 24-hour padding, the zone label, empty rendering for missing input |
| `tests/security/throttle-policy.test.ts` | Fixed-window sign-in budgets: blocking exactly at the limit, stale windows counting as empty, whole-second retry reporting, and the room-scale invariants — one shared venue address cannot lock out the whole room, one unit's guessing is still capped, credential and address budgets stay apart |
| `tests/navigation/participant-surfaces.test.ts` | Source-level separation of participant and operator surfaces: no unit-facing file references the standings route, no public standings feed exists, the legacy `/leaderboard` route resolves a session and holds no query |
| `tests/storyline/case-file.test.ts` | Case-file derivation: sealed links contribute nothing, briefings are carried verbatim, the chronology, what a broken link reports, and the reading cursor — a new unlock flags exactly once and a refresh never resurrects it |

## What these suites deliberately do not cover

Server-authoritative behaviour that needs a live database — lockout enforcement,
timer expiry, refresh persistence, duplicate-vote rejection at the unique
constraint, Round 1 completion, qualification application, Round 2 access gating
— lives in `src/server/game/engine.ts` behind transactional row locking, and is
exercised by **`scripts/smoke.ts`**:

```bash
CONFIRM_SMOKE=yes NODE_OPTIONS="--conditions=react-server" npx tsx scripts/smoke.ts
```

That script is **destructive** — it truncates the database it points at, and it
refuses to run while any link is un-armed, because submitting a placeholder
answer would "solve" that door and report a green rehearsal that proved nothing.
Use it against a local database, and read its header before running it.

The content itself is written to a live database by
**`scripts/apply-round1-content.ts`** (Round 1) and by `db/round-2-content.sql`
(Round 2). The script reads `ROUND1_PUZZLES` and normalizes through the engine's
own `normalizeAnswer`, so the stored answers cannot drift from the ones the
grader compares against:

```bash
CONFIRM_CONTENT=yes NODE_OPTIONS="--conditions=react-server" npx tsx scripts/apply-round1-content.ts
```
