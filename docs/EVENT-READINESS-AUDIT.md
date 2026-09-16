# ECO-SYNC EVENT READINESS REPORT

Audit date: 2026-09-14 · HEAD `9eccb87` · 117 tracked files · Next.js 16.2.6 / React 19.2.6

> **SUPERSESSION NOTICE (post-audit).** This report was written at HEAD `9eccb87`,
> when Round 1 carried 7 links and the roster held 60 team accounts. Since then the
> catalogue grew to **10 Round 1 links**, the roster to **61 teams**, and the scoring
> constants were retuned: points are now tiered 75 / 100 / 125 with a 150-point case
> code, hints cost 50, the first two wrong answers per puzzle are penalty-free and
> each subsequent one is −25 to the −50 cap, and the Round 1 ceiling is **1055**, not
> 830. The suspect roster was also replaced (now **4** subjects). The findings and
> reasoning below remain the record of that audit; only the specific counts drifted.
> Current truth lives in `src/server/game/catalogue.ts`, `constants.ts` and
> `README.md`, and `scripts/smoke.ts` re-derives its expectations from those at run
> time instead of hardcoding them.

Every claim below is labelled **CONFIRMED** (I ran it or read it), **LIKELY**, **POSSIBLE**, or
**UNKNOWN / NEEDS VERIFICATION**. Where I was unable to verify, I say exactly what to check.

---

## EXECUTIVE VERDICT

**ONLY AFTER FIXES.**

Not because the code is bad — it is unusually disciplined for an event project, and several things
I expected to be broken are not. The blocker is narrower and more mundane than "the app can't cope":

> **Production has never been verified from this repository, and this repository cannot reach it.**

The local `.env` points at `127.0.0.1:5432/app_db`. Production runs on Supabase. `drizzle.config.ts`
reads that same local `DATABASE_URL`, and there is no `migrations/` directory. So the schema and the
puzzle content that the live event will actually serve are **unverified**, and the rehearsal you ran
this morning (61 teams, fully armed, both rounds PENDING, 180 audit rows) proves the *local* database
is correct — which is not the same database.

Everything else on the P0/P1 list is a small number of real defects with concrete fixes, plus three
operator-safety gaps where a dangerous action can still be taken at the wrong moment.

**What is genuinely solid and should not be touched:** answer confidentiality (verified by grepping
the production client bundle — zero leakage), submission concurrency (`SELECT … FOR UPDATE`), route
authorization (every route guarded), and the sign-in throttle design.

---

## REMEDIATION LOG

**Added 2026-09-14, after the Top 10 fixes were applied.** The findings below are left as written —
minus two corrections, flagged inline — because they are the diagnostic record of what was wrong.
This section is the record of what changed and how each change was verified. Everything here is
**uncommitted in the working tree** at HEAD `59ab298`.

| Ref | Fix | How it was verified |
| --- | --- | --- |
| **P0-2** | `purgeEventAction` gained the live-round interlock copied from RESTART, a `consumeRateLimit` gate (`admin:purge:<operator>`, 2 per 10 min), the caller IP in its audit row, and all six revalidation paths. | `tsc` + `eslint` clean; interlock read back in source. |
| **P1-1** | `castVote` now accepts ROUND_2 in `ACTIVE` **or** `ENDED`, so pressing END no longer confiscates the ballot from units that earned it. Gated on `finalProgress === SOLVED` as before. The ended-round banner gained one conditional line saying the ballot outlives the round. | Confirmed the UI already renders the ballot after END (snapshot derives `vote.unlocked` from puzzle progress, not round status), so the engine guard was the only blocker. |
| **P1-2** | `applyQualification` refuses unless ROUND_1 is `ENDED` and ROUND_2 is `PENDING`; the now-unreachable status write inside the transaction was removed. | Checked `scripts/smoke.ts` first — it calls endRound(R1) → applyQualification → startRound(R2), so the guard is compatible. |
| **P1-3** | `src/app/error.tsx` (branded, retryable, prints the digest but never the error) and `src/app/global-error.tsx` (self-contained, inline styles, its own `<html>`). | Planted a route that throws; the RSC payload registers both as the segment's boundaries (`"error":"$1d"`, `boundary:error`, `boundary:global-error`) and their copy is present in the client chunks the browser is served. |
| **P1-4** | `src/app/team/loading.tsx` — one file covering all six participant routes, since `loading.tsx` applies to its segment and everything beneath it. | Present in the production server output (`.next/server/chunks/ssr/…`). |
| **P2-1** | `import "server-only"` added to `catalogue.ts`. `UNARMED_SENTINEL` moved to `unarmed.ts` (the guard-free side) so the pure content rule stays testable; `vitest.config.ts` aliases `server-only` to the package's own `react-server` build. | **Proved, not assumed:** planted a `"use client"` page importing the catalogue — `next build` failed with the exact trace `[Client Component Browser] → src/server/game/catalogue.ts`, while the legitimate Server Component traces still resolved. |
| **P4-2** | `isUnarmedAnswer("")` now returns `true`; the contradicting test assertion was flipped deliberately. | 80/80 unit tests pass. |
| **P4-3** | `unlockPuzzleForTeam` (engine) + `unlockPuzzleForTeamAction` (server action) + `TeamRepairPanel` on the unit file. Writes a `MANUAL_ADJUSTMENT` ledger row at `delta: 0` and an audit row; never downgrades a `SOLVED` link and never touches another unit. | Run against the live local database: opened S5 for UNIT-01 only, created exactly one progress row, wrote the ledger and audit rows, returned `ALREADY_OPEN` on a second press with no state change, then restored the database to its exact prior counts (`progress 0 / events 0 / audits 180`). |

**Still open**

- **P0-1** — cannot be closed from this machine. It needs `db/verify-round-2.sql` and
  `db/identify-content-revision.sql` run against the endpoint the *deployed* site reads. See the
  sharpened P0-1 below.
- **P3-1 / P3-5** — production schema path and release tagging. Process, not code.

**One defect found while fixing, not in the original audit.** `admin-controls.tsx` calls
`useFormStatus()` inside the components that *render* the `<form>` (`StartRoundForm`,
`EndRoundForm`, `QualifyForm`, `PurgeForm`, `RestartForm`, `SeedForm`). React only reports a form's
status to a component *inside* that form; called one level up it reads the enclosing context. If
that is what is happening, `pending` is always `false` and the destructive buttons never disable, so
a double-tap is possible. Worth confirming in a browser. `TeamRepairPanel` was written with the
submit button as a child component to avoid the trap.

---

## P0 — BLOCKING

### P0-1. The deployed site's database is unidentified, and local ≠ production

**Confidence: CONFIRMED (divergence) / UNKNOWN (deployed state)**

> **Sharpened 2026-09-14.** This was filed as "production content is unverified". Re-reading
> `docs/P0-EVENT-RUNBOOK.md` §0a makes it sharper, and worse: **three** Postgres endpoints are in
> play, and the third — the one the *deployed* site actually reads — has never been identified.

- **Evidence.** `.env` → `postgresql://postgres:***@127.0.0.1:5432/app_db`. `drizzle.config.ts:5`
  reads `process.env.DATABASE_URL` — the same local value. No `migrations/` directory exists
  anywhere; the schema path is `drizzle-kit push`. My read-only audit of the live database resolved
  `target: 127.0.0.1:5432` and reported ROUND_1/ROUND_2 both `PENDING`, 7 + 8 puzzles, every answer
  armed, `teams=60`, `admins=1`, `audit_logs=180`. That is the **local rehearsal DB**.
- **Three endpoints, one unidentified** (`P0-EVENT-RUNBOOK.md` §0a). `127.0.0.1:5432/app_db`
  (local, armed) and Supabase `ijsndlhcaxpzhugtoxnk` (armed) are both known and now agree. The
  deployed site reaches a database named only by Vercel's own server-side Postgres variable — and
  `src/db/index.ts:15` gives `DATABASE_URL` **precedence** over `DATABASE_POSTGRES_URL`. If Vercel
  carries a plain `DATABASE_URL` aimed at a third project, that project is the live one, and it is
  the one that may still hold a placeholder. This is not hypothetical: it is exactly how the
  `1 link un-armed: S7 (#6/8)` warning survived being "fixed" — the repair was applied to the wrong
  endpoint and reported success.
- **Why it matters.** `startRound` (`src/server/game/engine.ts:869`) fails closed by calling
  `auditRoundAnswers(round.id)`, which reads `puzzles.expectedAnswerNormalized` **from the database**.
  If production's Supabase still holds a placeholder for any Round 2 link, "Open Round 02" is refused
  — correctly, but in front of the room. The inverse is worse: if production's chain differs from
  `catalogue.ts` (which is what you rehearsed against), teams get answers that are wrong relative to
  the props, and every later link is stranded because the chain unseals `orderIndex + 1` by exact
  match.
- **How to reproduce.** Run `db/verify-round-2.sql` and `db/identify-content-revision.sql` in the
  Supabase SQL editor (production), not locally.
- **Exact fix.** First **identify** the endpoint the deployed site reads (§0a): run
  `db/identify-content-revision.sql` against it and read the verdict line — `SUPPLIED revision` or
  `RETIRED revision`. Only then run `db/verify-round-2.sql` and compare the returned codes,
  `order_index` and armed-state against `src/server/game/catalogue.ts` (`ROUND1_PUZZLES`,
  `ROUND2_PUZZLES`). Then write down the production schema path — right now nobody can say how
  production's schema was applied, so nobody can say how to re-apply it.
- **Files.** `.env`, `drizzle.config.ts`, `db/verify-round-2.sql`, `db/identify-content-revision.sql`,
  `db/arm-s7.sql`, `src/server/game/content-guard.ts`, `src/server/game/engine.ts:869`.
- **Verification.** Expect `still_unarmed_in_round_2 = 0`, `characters = 7`, and a code list of
  exactly `S1, S3, S4, S5, S6, S7, S8, LAST`. Any other code list means production has drifted.

### P0-2. `purgeEventAction` can destroy the event mid-round, with no interlock

**Confidence: CONFIRMED**

- **Evidence.** `src/server/admin/actions.ts:322`. It calls `requireAdmin()` and checks the typed
  phrase `PURGE` (line 327) — and nothing else. It then deletes `puzzles`, `rounds`, `teams` and
  every access code inside one transaction. By contrast `restartEventAction` (line 218) refuses when
  any round is `ACTIVE`: *"Round 01 is still live. End it first, then restart."* and is rate-limited
  (line 234). PURGE has neither the interlock nor the rate limit.
- **Why it matters.** `teams` and `rounds` are deleted, so recovery means re-seeding, which generates
  **new** access codes (`scripts/seed-event.ts` uses `randomBytes(8)`), which invalidates every printed
  credential slip in the room. This is the one action that cannot be recovered from without a
  developer and a printer.
- **How to reproduce.** Start a round, then run PURGE from the command deck's danger zone. It
  succeeds.
- **Exact fix.** Copy the `liveRounds` interlock from `restartEventAction` into `purgeEventAction`
  before the transaction, and apply the same `consumeRateLimit` gate. Consider requiring the round to
  be `ENDED` *and* a second distinct phrase.
- **Files.** `src/server/admin/actions.ts:322-355`, `src/components/admin/admin-controls.tsx`
  (the `<details>`-wrapped `PurgeForm`).
- **Verification.** With a round ACTIVE, PURGE returns a refusal and deletes nothing; `select count(*)
  from teams` is unchanged.

---

## P1 — SERIOUS

### P1-1. Ending Round 2 permanently closes the culprit vote

**Confidence: CONFIRMED**

- **Evidence.** `castVote` (`src/server/game/engine.ts:641`) returns `ROUND_NOT_ACTIVE` unless
  `round.status === "ACTIVE"` for `ROUND_2`. `endRound` (line 911) sets `ENDED`. Note the asymmetry:
  `submitAnswer` also checks `round.endsAt` (line 322) but `castVote` does not — so voting survives
  the clock running out, but dies the moment an operator presses END.
- **Why it matters.** A unit that breaks `LAST` at minute 74 has one minute to vote. If the operator
  ends Round 02 at the 75-minute mark — the obvious thing to do — every unit that has not yet voted is
  locked out of the game's finale, permanently, with no override.
- **Exact fix.** Decide the intended rule and make it explicit. Safest: allow `castVote` while
  `ROUND_2` is `ACTIVE` **or** `ENDED`, gated on `finalProgress.status === "SOLVED"`. Alternatively
  document loudly in the runbook: "do not end Round 02 until every qualified unit has voted."
- **Files.** `src/server/game/engine.ts:630-692`, `src/server/admin/actions.ts:158`,
  `docs/P0-EVENT-RUNBOOK.md`.
- **Verification.** Solve `LAST`, end Round 02, attempt a vote — currently refused.

### P1-2. Running "Qualify top 15" during Round 1 cuts the round short for everyone

**Confidence: CONFIRMED**

- **Evidence.** `applyQualification` (`src/server/game/engine.ts:939`) performs **no status checks**.
  It ranks the current standings, then at line 982 sets `ROUND_1.status = "ENDED"` if it is not already
  ended. `qualifyTop15Action` (`src/server/admin/actions.ts:174`) gates only on the word `CONFIRM`.
  The UI label reads "Rank Round 01 · mark top 15 · rebuild Round 02 roster. **Idempotent**"
  (`admin-controls.tsx`), which invites casual pressing.
- **Why it matters.** Press it while Round 01 is live and the round ends instantly for all 61 teams,
  standings frozen mid-round, and Round 02's roster built from partial data. Because it is described
  as idempotent, an operator may press it twice.
- **Second-order hazard (this is the one already recorded in project notes):** it does
  `tx.delete(roundParticipations).where(eq(roundParticipations.roundId, r2.id))` and re-inserts only
  the qualified set. Re-run it while Round 02 is live and the R2 roster is rebuilt from *current* R1
  standings — any unit whose R1 rank shifted is ejected mid-Round-02 (`NOT_QUALIFIED` on submit).
- **Exact fix.** In `applyQualification`, refuse unless `r1.status === "ENDED"`. Refuse if
  `r2.status !== "PENDING"`. Both are cheap guards in the same style as `startRound`'s transition
  check.
- **Files.** `src/server/game/engine.ts:939-1000`, `src/server/admin/actions.ts:174`.
- **Verification.** With ROUND_1 ACTIVE, the action returns a refusal and `rounds.status` is
  unchanged.

### P1-3. No error boundary anywhere — a server error shows Next's generic page mid-round

**Confidence: CONFIRMED**

- **Evidence.** `find src/app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"`
  returns nothing. The build output confirms only the built-in `/_not-found`.
- **Why it matters.** Round pages are `force-dynamic` and make ~10 database round-trips per render. A
  transient pooler failure produces an unhandled server error. The team sees Next's default error
  screen — no branding, no explanation, no retry affordance — and cannot tell whether the game broke
  or their phone did. With 75 phones polling every 8 seconds, one bad minute looks like a dead event.
- **Exact fix.** Add `src/app/error.tsx` (client) and `src/app/global-error.tsx` with on-brand copy and
  a "retry" that calls `reset()`, plus `src/app/team/round-1/error.tsx` style boundaries so a failure
  in the console keeps the shell and navigation intact.
- **Files.** `src/app/**` (new files), `src/components/game/round-states.tsx` for tone reference.
- **Verification.** Throw deliberately in `getTeamRoundSnapshot`; confirm the branded boundary renders
  instead of Next's default.

### P1-4. No `loading.tsx` — tab navigation on a slow phone shows nothing

**Confidence: CONFIRMED**

- **Evidence.** No `loading.tsx` in `src/app/**`. Every participant route is `force-dynamic`.
- **Why it matters.** `AutoRefresh` keeps the *current* page fresh, but switching tabs
  (STORYLINE/ANSWERS/SUSPECTS) is a fresh server render. On a congested venue AP that is a visible
  dead tap. Mobile users tap again, which stacks requests.
- **Exact fix.** Add a `loading.tsx` per participant route that renders the shell plus a skeleton, so
  navigation feels instant.
- **Files.** `src/app/team/round-{1,2}/{,storyline/,suspects/}loading.tsx`.
- **Verification.** Throttle to Slow 3G in devtools and switch tabs.

---

## P2 — SECURITY

### P2-1. `catalogue.ts` holds every answer and has no `server-only` guard

**Confidence: CONFIRMED**

- **Evidence.** `grep -c "server-only" src/server/game/catalogue.ts` → `0`. The file opens with a
  comment reading *"[SERVER-ONLY — CONFIDENTIAL] … must NEVER be imported by client components"* —
  it is protected by convention only. Compare `content-guard.ts`, `guards.ts`, `auth-throttle.ts`,
  `audit/log.ts`, `rate-limit.ts`, `request.ts`, all of which `import "server-only"`.
- **Exploit path.** One careless `import { SUSPECTS } from "@/server/game/catalogue"` inside a
  `"use client"` file bundles every answer, hint and the culprit identity into a publicly served
  JavaScript chunk. No build error, no lint error (this ESLint config has no such rule).
- **Current exposure: none.** I grepped the production build: `NIGHTOWL`, `VIKRAM_SHETTY`, `DELETED`,
  `expectedAnswerNormalized` and `UNARMED_SENTINEL` each appear in **0** files under `.next/static`.
  They appear only in `.next/server/chunks/ssr/*`. The boundary holds today.
- **Exact fix.** Add `import "server-only";` as the first line of `catalogue.ts`. It is a one-line
  change that converts a convention into a compile-time guarantee. Do the same for
  `src/server/game/seed.ts` and `src/server/game/unarmed.ts`'s catalogue import path.
- **Files.** `src/server/game/catalogue.ts`.
- **Verification.** `npx next build` still succeeds; a deliberate client-side import now fails the
  build.

### P2-2. `seedEventAction` is callable without authentication while zero admins exist

**Confidence: CONFIRMED**

- **Evidence.** `src/server/admin/actions.ts:70-76`: it counts admins and only calls `requireAdmin()`
  when `adminCount > 0`. Otherwise it proceeds. Server Actions are POST endpoints, so the check is
  reachable without ever loading `/admin`.
- **Exploit path.** Against a fresh database (new Supabase project, or after an environment
  rebuild), anyone who knows the action id can seed the event and create the **first admin account**,
  which they then control. Rate limit is `8 / 10 min` keyed on the IP — and `consumeRateLimit` is
  in-memory and per-instance (`src/lib/security/rate-limit.ts`), so it resets on cold start.
- **Mitigating.** After any seed, `admins` is non-empty forever — `purgeEventAction` deliberately
  preserves admins — so the window closes permanently after first use.
- **Exact fix.** Require an out-of-band bootstrap secret for first-run seeding (env var), or gate the
  form behind a one-time token printed by `scripts/seed-event.ts`.
- **Files.** `src/server/admin/actions.ts:62-135`.
- **Verification.** On an empty DB, POST the action without a session and confirm it is refused.

### P2-3. No security headers configured

**Confidence: CONFIRMED**

- **Evidence.** `next.config.ts` contains only `allowedDevOrigins`. No `headers()` block, no
  `vercel.json`. Vercel supplies HSTS (observed: `strict-transport-security: max-age=63072000`), but
  there is no CSP, `X-Frame-Options`/`frame-ancestors`, or `Referrer-Policy`.
- **Why it matters.** The app renders user-supplied strings — `puzzle_attempts.submitted_answer` is
  displayed in the admin team-detail table. React escapes by default, so this is defence-in-depth
  rather than a live XSS. The realistic risk is **clickjacking**: the login and answer forms can be
  framed by a third party, and the event URL is semi-public.
- **Exact fix.** Add a `headers()` block in `next.config.ts` setting `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, and a CSP that starts in
  report-only mode (Next's inline bootstrap scripts make an enforcing CSP a separate piece of work).
- **Files.** `next.config.ts`.
- **Verification.** `curl -I` the deployment and confirm the headers appear.

### P2-4. In-memory rate limiter does not survive serverless

**Confidence: CONFIRMED** (acknowledged in the module's own comment)

- **Evidence.** `src/lib/security/rate-limit.ts:16` — `const buckets = new Map<string, Bucket>()`.
  The doc comment states it is per-instance and says to swap for Redis if scaled. It gates
  `admin:seed` (8/10 min) and `admin:restart` (3/10 min).
- **Why it matters.** On Vercel each concurrent instance has its own map, so the effective limit is
  `limit × instances`, and every cold start resets it to zero. These are the gates on the two most
  destructive actions. The typed phrases (`RESTART`, `PURGE`) are doing the real work.
- **Exact fix.** Either accept it explicitly (document that the phrase is the control) or move these
  two counters into `auth_throttle`, which is already DB-backed and already keyed by operator id.
- **Files.** `src/lib/security/rate-limit.ts`, `src/server/admin/actions.ts:84,234`.
- **Verification.** Call `restartEventAction` 5 times across a redeploy.

### P2-5. Session rows are never swept

**Confidence: CONFIRMED**

- **Evidence.** `getSessionView` (`src/lib/auth/session.ts`) deletes a row only when *that* token is
  presented and found expired. `restartEventAction` deletes TEAM sessions. Nothing else prunes.
- **Why it matters.** Low — the table is small and indexed on `expires_at` — but on a long-running
  deployment it grows unbounded, and stale rows are indistinguishable from live ones without a query.
- **Exact fix.** Opportunistic sweep, same pattern as `maybePruneExpired` in `auth-throttle.ts`.
- **Files.** `src/lib/auth/session.ts`.
- **Verification.** Count `sessions` before/after a sweep.

---

## P3 — INFRASTRUCTURE / DATABASE

### P3-1. No versioned migrations and no documented production schema path

**Confidence: CONFIRMED**

- **Evidence.** No `migrations/` directory. `drizzle.config.ts` uses `drizzle-kit push` against
  `DATABASE_URL` (local). The README instructs `npx drizzle-kit push` at line 79 — which, per P0-1,
  targets localhost.
- **Why it matters.** There is no record of what schema production actually has, no way to diff it,
  and no rollback. If a column is needed live, someone hand-writes SQL.
- **Exact fix.** Run `npx drizzle-kit generate` to create a versioned baseline, commit `migrations/`,
  and record in the runbook how production is brought to that revision.
- **Files.** `drizzle.config.ts`, `README.md:79`, new `migrations/`.
- **Verification.** `npx drizzle-kit check` reports no drift.

### P3-2. No error reporting or monitoring

**Confidence: CONFIRMED**

- **Evidence.** No Sentry/Bugsnag/Datadog/Logflare in `package.json`. All error paths are
  `console.error(...)` — `logAudit`, `loginTeam`/`loginAdmin` lookup failures, `seedEventAction` —
  which land in Vercel function logs and nowhere else. `@vercel/analytics` and
  `@vercel/speed-insights` are mounted (`src/app/layout.tsx:56-57`) but they report page views and
  Core Web Vitals, not exceptions.
- **Why it matters.** During the event nobody is tailing logs. A silent failure — e.g. `logAudit`
  swallowing every write — would be invisible until someone went looking for evidence.
- **Exact fix.** Add Sentry (or equivalent) with a server-side `instrumentation.ts`, or at minimum a
  scheduled `db-status.mjs` run every 5 minutes by the operator.
- **Files.** `package.json`, new `instrumentation.ts`.
- **Verification.** Force an exception and confirm it is reported off-platform.

### P3-3. Local `.env` and production are different databases with no sync

**Confidence: CONFIRMED**

- **Evidence.** `.env` → `127.0.0.1:5432/app_db`. Production → Supabase `ap-south-1`
  (`ijsndlhcaxpzhugtoxnk`). `db/arm-s7.sql`, `db/verify-round-2.sql` and `db/identify-content-revision.sql`
  exist precisely because production has to be armed by hand in the SQL editor.
- **Why it matters.** Content fixes rehearsed locally do not reach production. This is the mechanism
  behind the "S7 still showing as un-armed" incident in project notes.
- **Exact fix.** Treat production as the source of truth for content. Make arming a scripted step that
  runs against production, and re-run `verify-round-2.sql` as the gate before opening Round 02.
- **Files.** `db/*.sql`, `docs/P0-EVENT-RUNBOOK.md`.
- **Verification.** `verify-round-2.sql` against production returns a fully armed chain.

### P3-4. `.claude/settings.local.json` is tracked

**Confidence: CONFIRMED**

- **Evidence.** `git ls-files` lists `.claude/settings.local.json` (content is a single
  `Bash(npm run *)` permission grant — harmless today). `.gitignore` covers `.vscode/` and `.idea/`
  but not `.claude/`.
- **Exact fix.** `git rm --cached .claude/settings.local.json` and add `.claude/` to `.gitignore`.
- **Verification.** `git status` stays clean after editing local settings.

### P3-5. No rollback plan and no release tagging

**Confidence: CONFIRMED**

- **Evidence.** `git tag` is empty; deployment is "push to main → Vercel builds". Vercel retains
  previous deployments, so a rollback *is* possible via the dashboard, but nothing in the runbook
  says so.
- **Exact fix.** Tag the commit that is running the event (`git tag event-2026-09-14`) and write one
  line in the runbook: "roll back in Vercel → Deployments → previous → Promote".
- **Verification.** Confirm the tag exists and the runbook names the rollback path.

---

## P4 — GAME LOGIC / PUZZLES

### P4-1. Round 2 has zero hints on all eight links — **a documented decision, but only half-carried-out**

**Confidence: CONFIRMED — and it is a stated decision, not an oversight**

> **Corrected 2026-09-14.** This was filed as a gap ("decide deliberately; do not leave it implicit").
> That was wrong — it *is* explicit. `docs/P0-EVENT-RUNBOOK.md:288` records Round 2's `hints: []` as
> a deliberate decision and names the remedy: *"Either seed real hints or drop the control for this
> round; an unusable button on a mobile screen reads as a bug to a team under time pressure."* The
> decision was made. What is still undone is the second half of it.

- **Evidence.** Structural audit of `catalogue.ts` and of the local database: `ROUND_1` — every puzzle
  has exactly 1 hint. `ROUND_2` — `S1, S3, S4, S5, S6, S7, S8, LAST` all have **0** hints. Both
  catalogue and DB agree, so this is intentional, not drift — and the runbook confirms it is.
- **Why it matters.** The chain unseals `orderIndex + 1` by exact match, so a team stuck on `S4`
  cannot reach `S5`. In Round 1 the hint is a release valve that costs 30 points; in Round 2 there is
  none. That is a legitimate design choice for a 15-unit round — but the *control* is still rendered,
  so every link shows a button that does nothing, which is the specific outcome the runbook warns
  reads as a bug. P4-3's repair lever now covers the operator side of this.
- **Exact fix.** Pick one of the two the runbook already offers: seed one hint per Round 2 link, or
  hide the hint control when `hints.length === 0`. Doing neither leaves a live, tappable control that
  cannot respond.
- **Files.** `src/server/game/catalogue.ts` (`ROUND2_PUZZLES`), `db/round-2-content.sql`,
  `src/components/game/round-console.tsx` (the hint control).
- **Verification.** Re-run the structural audit; expect `hints = 1` for each R2 link, or a console
  that renders no hint control at all.

### P4-2. The content guard cannot see an empty answer

**Confidence: CONFIRMED**

- **Evidence.** `isUnarmedAnswer` (`src/server/game/unarmed.ts`) returns true only for
  `UNARMED_SENTINEL` or `/^__[A-Z0-9_-]+__$/`. `""` matches neither. `startRound`'s guard
  (`engine.ts:869-891`) therefore treats an empty `expected_answer_normalized` as armed.
  `expectedAnswerNormalized` is `notNull()` but has no `length > 0` constraint (`schema.ts:133`).
- **Why it matters.** An empty answer opens the round and can never be solved: `submitAnswerAction`
  rejects `answer.length === 0` (`src/server/team/actions.ts:30`), so the empty string is unreachable
  from the UI. The link is permanently unsolvable and every later link is stranded — the exact failure
  the guard exists to prevent, arriving through the one input it does not inspect.
- **Exact fix.** Add `|| normalized.length === 0` to `isUnarmedAnswer`, and a `CHECK
  (length(expected_answer_normalized) > 0)` in the schema.
- **Files.** `src/server/game/unarmed.ts`, `src/db/schema.ts:133`,
  `tests/engine/content-guard.test.ts`.
- **Verification.** Unit-test `isUnarmedAnswer("")` → currently `false`, should be `true`.

### P4-3. The chain has no per-team escape hatch and `MANUAL_ADJUSTMENT` is never written

**Confidence: CONFIRMED**

- **Evidence.** `scoreEventTypeEnum` defines `MANUAL_ADJUSTMENT` (`schema.ts:54`) and
  `grep -rn "MANUAL_ADJUSTMENT" src scripts` finds it **only** in the schema — no code path writes it.
  The complete set of admin actions is `seedEventAction`, `startRoundAction`, `endRoundAction`,
  `qualifyTop15Action`, `restartEventAction`, `purgeEventAction`. There is no per-team action at all.
- **Why it matters.** If one team's chain breaks (a bad row, a mistyped answer the puzzle actually
  wants, a puzzle edited after the round opened), the operator's only tools are global and
  destructive: RESTART wipes all 61 teams, PURGE wipes the event. There is no "unlock S5 for UNIT-23",
  no "add 20 points to UNIT-07", no "reset this team's lockout".
- **Exact fix.** Add one audited admin action — `unlockPuzzleForTeamAction(teamId, puzzleCode)` —
  writing a `MANUAL_ADJUSTMENT` score event and an `audit_logs` row. This is the highest-value
  non-blocking addition in the report.
- **Files.** `src/server/admin/actions.ts`, `src/server/game/engine.ts`, `src/app/admin/teams/[id]/page.tsx`.
- **Verification.** Break a team's chain deliberately, then repair it from the deck without touching
  any other team.

### P4-4. `castVote` does not honour the round clock, `submitAnswer` does

**Confidence: CONFIRMED**

- **Evidence.** `submitAnswer` (`engine.ts:322`) returns `ROUND_EXPIRED` when
  `now >= round.endsAt`. `castVote` (`engine.ts:637-643`) checks only `round.status`.
- **Why it matters.** Almost certainly benign — you *want* votes after the clock — but it is an
  undocumented asymmetry. The behaviour depends on the operator not pressing END (see P1-1), which
  makes the intended rule impossible to infer from the code.
- **Exact fix.** Make it explicit in a comment and align with the P1-1 decision.
- **Files.** `src/server/game/engine.ts:630-643`.
- **Verification.** Expire Round 02's clock without ending the round; confirm voting still works.

### P4-5. What is correct and verified in the chain (do not change)

**Confidence: CONFIRMED** — counts re-verified after the Round 1 expansion to 10 links.

- Round 1: **10 links**, `orderIndex` contiguous 1–10, all `DIGITAL`, points tiered by
  difficulty (75 easy / 100 medium / 125 hard) with `P10` the 150-point case code,
  sum **975**. Round 2: 8 links, contiguous 1–8, `LAST` is `orderIndex 8`, kind
  `FINAL_CODE`, 150 pts.
- **Zero** unarmed answers, **zero** empty answers, **zero** duplicate answers within or across
  rounds, **zero** empty hint strings, **zero** missing briefings, all codes unique.
- Every answer is already in normalized form (NFKC + trim + uppercase) — the round-trip is stable.
- `round1.puzzleCount = 10` matches the catalogue; `round2.puzzleCount = 8` matches.
- Achievable Round 1 maximum = 975 + (40 × 2) = **1055**, exactly equal to
  `GAME_CONSTANTS.scoring.maxRound1Score`. The scoring constants are internally consistent.
- 4 suspects, no duplicate codes or names, and `CORRECT_SUSPECT_CODE` is present in `SUSPECTS`.
- **The `S2` code gap is intentional and documented** — `db/identify-content-revision.sql` lists
  `S2` among the RETIRED rows, and `README.md` states the Round 2 play order as
  `S1 → S3 → S4 → S5 → S6 → S7 → S8`. Not a defect. I nearly reported it as one.

---

## P5 — PARTICIPANT UX

### P5-1. No loading or error affordance on the participant surface

Covered as P1-3 and P1-4. On a congested AP these are the two states a team is most likely to see.

### P5-2. The answer input gives no signal that the round clock has expired

**Confidence: LIKELY**

- **Evidence.** `round-console.tsx`: `roundDead` is computed from
  `snapshot.round.remainingSeconds <= 0` and folds into `roundEnded`, which disables the input and
  submit button. The countdown renders `TIME EXPIRED` in `ServerCountdown`. But `snapshot` is only
  refreshed by `AutoRefresh` (8 s), so there is a window where the clock reads expired and the input
  is still enabled.
- **Why it matters.** A team types a full answer, presses submit, and gets `ROUND_EXPIRED` from the
  server. The message is clear, so this is friction rather than a dead end.
- **Exact fix.** Drive `roundEnded` from the live `ServerCountdown` remaining value rather than the
  stale snapshot.
- **Verification.** Watch a round expire with the tab focused; the input should disable within ~1 s.

### P5-3. Storyline unread badge is per-device, not per-team

**Confidence: CONFIRMED**

- **Evidence.** `src/lib/storyline/use-storyline-read.ts` persists the cursor in `localStorage` under
  `storylineStorageKey(roundCode, teamName)`, deliberately using `useSyncExternalStore` with a
  server snapshot to avoid a hydration mismatch.
- **Why it matters.** A team with two phones sees independent unread counts; clearing site data
  marks everything unread. This is a reasonable design, but worth knowing before an operator is
  asked "why does my phone say 6 unread".
- **Exact fix.** None required. Document it.

### P5-4. Correct-answer feedback fires a second refresh

**Confidence: CONFIRMED**

- **Evidence.** `round-console.tsx:63-67`: on `state.status === "correct"` it emits the storyline
  signal *and* calls `router.refresh()`, on top of the 8 s `AutoRefresh` and the server action's own
  `revalidatePath` calls.
- **Why it matters.** Harmless at this scale, but it is three overlapping refresh mechanisms where
  one would do. Worth simplifying if touched.

---

## P6 — ADMIN / OPERATOR UX

### P6-1. No surgical intervention tooling

See P4-3. This is the single biggest operator gap. Every tool the operator has is either global or
destructive.

### P6-2. Confirmation design is good and should be kept

**Confidence: CONFIRMED**

- `CONFIRM` for seed / start / end / qualify, `RESTART` for restart, `PURGE` for purge — graduated,
  with `restartEventAction` additionally refusing while a round is live and rate-limited to 3 per
  10 minutes. PURGE is inside a collapsed `<details>` in the danger zone. This is exactly the pattern
  the brief asked for; P0-2 is the one place it was not applied.

### P6-3. Unarmed content is surfaced proactively on the deck

**Confidence: CONFIRMED**

- `src/app/admin/page.tsx` runs `auditRoundAnswers` on load and displays unarmed Round 2 links before
  the operator clicks anything, with `safeCount` try/catch wrappers so the deck stays readable when
  the database is unhappy. Good.

### P6-4. `purgeEventAction` revalidates only `/admin`

**Confidence: CONFIRMED**

- **Evidence.** `src/server/admin/actions.ts:353` — `revalidatePath("/admin")` only, whereas
  `restartEventAction` revalidates six paths including `/lobby`.
- **Why it matters.** After a purge, `/admin/teams`, `/admin/leaderboard`, `/admin/votes` and
  `/admin/audit` may render stale cached data. Low impact given they are `force-dynamic`, but
  inconsistent with RESTART.

### P6-5. The "Qualify" panel says "Idempotent" without stating the preconditions

See P1-2. The label is technically true and operationally misleading.

---

## P7 — PERFORMANCE / SCALE

### P7-1. Measured capacity is comfortable at 60–75 teams

**Confidence: CONFIRMED** (measured against the live deployment)

- Functions run in **Mumbai** (`X-Vercel-Id: bom1`), matching Supabase `ap-south-1`. Warm database
  latency from `/api/health`: **2–3 ms** (occasional 12–26 ms pooler spikes); cold connection 110 ms.
- Each participant render is **~10 queries** (1 session join + ~9 in `getTeamRoundSnapshot`) plus two
  idempotent bootstrap inserts, ≈ 5–6 KB of database egress and ~30 ms of database time.
- `AutoRefresh` intervals: 8 s active round (`round-console.tsx:339`), 5 s standby
  (`round-states.tsx:19`), 10 s gated, 12 s lobby — all visibility-gated, so a locked phone polls
  nothing. 75 clients × 8 s = **9.4 req/s ≈ 113 queries/s**, roughly 28% of one connection.
- Connection ceiling: `max: 3` per instance (`src/db/index.ts:59`) × instances = single digits, well
  inside Supabase's transaction pooler.
- Client payloads: landing 5.7 KB brotli, `/login` 5.8 KB, RSC refresh payload 3.4 KB. Total client
  chunks 884 KB. Nothing here is a problem for 60–120 phones.

### P7-2. `getTeamRoundSnapshot` selects every puzzle column on every poll

**Confidence: CONFIRMED**

- **Evidence.** `engine.ts:143-147` — `db.select().from(puzzles)` — which includes
  `expected_answer_normalized` and the full `hints` JSONB. These stay server-side (verified in P2-1),
  but they transit into function memory ~9.4 times a second.
- **Why it matters.** Small but pointless: it inflates database egress and widens the blast radius of
  any future logging mistake. The same function already selects narrow column lists elsewhere
  (line 342), so the pattern exists.
- **Exact fix.** Select only `id, code, orderIndex, kind, title, briefing, points, hints`. The answer
  is not needed here — `submitAnswer` fetches its own row.

### P7-3. Vercel Analytics and Speed Insights load on every participant page

**Confidence: CONFIRMED**

- **Evidence.** `src/app/layout.tsx:56-57` mounts `<Analytics />` and `<SpeedInsights />`; both are
  production dependencies. The app is `robots: noindex, nofollow`.
- **Why it matters.** Two extra third-party script fetches per page load across 60–120 phones on one
  congested AP, collecting data nobody will read for a private one-day event. Removing them is a free
  win on the venue network.
- **Exact fix.** Drop both from the layout (or gate them behind `NODE_ENV`).

---

## P8 — MOBILE / ACCESSIBILITY

### P8-1. Tablet widths are effectively unhandled

**Confidence: CONFIRMED**

- **Evidence.** Breakpoint usage across `src/components`: `sm:` 80, `md:` **2**, `lg:` 37, `xl:` 1,
  `2xl:` 0. The layout goes from phone styles straight to `lg:` (1024 px) with almost nothing at
  `md:` (768 px).
- **Why it matters.** A 768 px tablet gets the stretched single-column phone layout — the admin
  progression and ledger tables in particular are designed to switch at `sm:`/`lg:`. The brief asks
  specifically about 768 px and it is the weakest width in the app.
- **Exact fix.** Add `md:` steps where the tables and the two-column admin grids currently jump from
  one column to `lg:`.

### P8-2. Forms rely on placeholders rather than labels

**Confidence: CONFIRMED**

- **Evidence.** Across all of `src/components`: 2 `<label>` elements, 5 `aria-label`, 8 `aria-*`, 1
  `sr-only`, 12 `focus-visible`. The answer input uses `aria-label` plus `placeholder="ENTER ANSWER"`;
  login inputs use `placeholder` + `autoComplete`.
- **Why it matters.** Placeholder-as-label is a WCAG 3.3.2 weakness — the prompt vanishes the moment
  a user types, which is worst exactly where it matters (an access code). `focus-visible` coverage is
  good, so the visual keyboard story is fine; the labelling is the gap.
- **Exact fix.** Add visible or `sr-only` `<label>` elements bound by `htmlFor`/`id` in
  `src/components/ui/field.tsx`, which would fix every form at once.

### P8-3. Bottom-navigation clearance is hard-coded

**Confidence: LIKELY**

- **Evidence.** `team-shell.tsx:73` — `pb-[7.5rem]` (120 px) on mobile; `participant-nav.tsx` uses
  `py-2.5` with 18 px icons plus `pb-[env(safe-area-inset-bottom)]`.
- **Why it matters.** 120 px clears the ~44–60 px nav comfortably today. The risk is latent: changing
  the nav height without re-deriving `7.5rem` produces content hidden behind the bar.
- **Exact fix.** Express the clearance as a CSS variable shared by both components.

---

## P9 — TESTING / CI

### P9-1. There is no CI at all

**Confidence: CONFIRMED**

- **Evidence.** No `.github/workflows/`. No CI configuration of any kind. Deployment is "push to main
  → Vercel builds". Vercel runs `next build`, which does typecheck — so a type error blocks a deploy.
  But **ESLint and the 76 unit tests never run automatically.**

### P9-2. `package.json` has no `test` script

**Confidence: CONFIRMED**

- **Evidence.** Scripts are `dev`, `build`, `start`, `lint`, `typecheck`. The suite is run as
  `npx vitest run`. The README correctly documents the `npx` form, so nothing is broken — but the
  event-day suite has no canonical entry point, and `lint` is `eslint .` while the runbook says
  `eslint src tests`, so the two disagree about scope.

### P9-3. The suite is real and currently green

**Confidence: CONFIRMED**

- `npx vitest run` → **76 passed / 8 files** in 670 ms. `npx tsc --noEmit` → exit 0.
  `npx eslint src tests` → exit 0. `npx next build` → **succeeds** in 25 s, all participant routes
  correctly `ƒ` (dynamic). These are not false-confidence tests: `tests/engine/content-guard.test.ts`
  and `tests/security/throttle-policy.test.ts` assert the actual event-critical invariants
  (placeholder detection, room-scale sign-in headroom).

### P9-4. Missing coverage on the event-critical paths

**Confidence: CONFIRMED** (by absence)

- No test exercises `submitAnswer`'s concurrency (double-submit), `castVote`'s one-vote-per-team
  backstop, `startRound`'s refusal on unarmed content, or `applyQualification`'s idempotence. These
  are exactly the paths that decide whether the event survives, and they are the ones with no
  automated guard.

### P9-5. README's test count is already stale

**Confidence: CONFIRMED**

- `README.md:68` claims "75 tests across 8 files". Actual: **76**. The number drifts every time a test
  is added; state the file count and drop the test count.

---

## P10 — MAINTAINABILITY

- **`package.json` is still named `nextjs-postgresql-template`** (line 2). CONFIRMED. Cosmetic but it
  is the first thing anyone sees.
- **`next-env.d.ts` is tracked and churns.** CONFIRMED. It contains
  `import "./.next/dev/types/routes.d.ts"` after `next dev` and
  `import "./.next/types/routes.d.ts"` after `next build` — a tracked file referencing a **gitignored**
  path, flipping content depending on which command ran last. It showed as modified after my build.
  On a clean clone, typecheck depends on having run `dev` or `build` first. This is also the file
  behind the previously recorded "~21 bogus syntax errors" from a truncated
  `.next/dev/types/routes.d.ts`. Consider untracking it.
- **No `middleware.ts`.** CONFIRMED. Authorization is per-route. I verified **every** route has a
  guard: all `/admin/*` (except login) use `requireAdmin`; `/admin/login`, `/login`, `/leaderboard`
  use `getSessionView` and redirect; `/lobby` uses `requireTeam`; the six `/team/round-*` routes
  delegate to `loadTeamRoundContext` → `requireTeam()`. Coverage is complete today; the exposure is
  that a future route can be added with no guard and nothing will catch it.
- **`/leaderboard` is correctly inert.** CONFIRMED. It resolves the session and redirects —
  ADMIN → `/admin/leaderboard`, TEAM → `/lobby`, anonymous → `/login` — and calls no standings query,
  so it cannot leak a score. `publicLeaderboard` exists in `engine.ts` but is only reached from admin
  surfaces.
- **No `TODO`/`FIXME`/`HACK`/`XXX` anywhere in `src`, `scripts` or `db`.** CONFIRMED. Unusual and
  worth preserving.
- **`rate-limit.ts` vs `auth-throttle.ts` are two different throttling mechanisms** with different
  storage guarantees. Not a bug; a naming trap for the next person.

---

## P11 — VISUAL / "VIBE-CODED" PROBLEMS

I did not re-open the visual redesign question — project notes record that a full redesign was
implemented and reverted at your instruction, and that the current look is intentional. I am not
proposing one.

For the record, the brief's stated concerns are largely absent from the code: the effect stack is a
single component (`src/components/fx/backdrop.tsx`, five layers) rather than scattered decoration; the
palette is a real token set with documented contrast reasoning in `globals.css`; `prefers-reduced-motion`
is honoured; and the "vibe-coded" tells the brief lists — excessive radius, neon glow on every surface,
inconsistent spacing — are not what is there.

The one thing I would raise, and only as an observation: `globals.css` still defines six animation
tokens (`scan-band`, `blink-dot`, `marquee`, `flicker`, `reveal-up`, `badge-pop`) and the backdrop
carries a drifting scan band and a flickering glow. On 60–120 phones on one AP, that is continuous
compositing work on the GPU for pure decoration. It costs nothing on the server; it costs battery on
the handsets. Reducing it is a judgement call, not a defect.

---

## P12 — NICE-TO-HAVE POLISH

- `SESSION_TTL_HOURS` defaults to 12 (`src/lib/auth/session.ts`). A 40 + 75 minute event plus setup
  fits comfortably, but a team that logs in during setup and returns after a long lunch would be
  logged out. Consider 24 for event day.
- `puzzleAttempts` keeps the raw submission (up to 500 chars). Useful for forensics; ensure the
  operator knows it is there before the event, because it is the fastest way to answer "what did
  UNIT-23 actually type".
- `scripts/db-status.mjs` and `scripts/db-participation.mjs` already exist. Wiring `db-status.mjs`
  into a 5-minute loop on the operator laptop would give you the monitoring that P3-2 says is missing.
- Add `"test": "vitest run"` and `"smoke": "tsx scripts/smoke.ts"` to `package.json` so the event-day
  commands are canonical.

---

## TOP 10 THINGS TO FIX FIRST

Ordered by event risk, not by effort.

> **Status 2026-09-14.** Eight of the ten are done and verified — see the REMEDIATION LOG at the top
> of this report. **#1 cannot be closed from this machine** (it needs a SQL editor pointed at the
> deployed endpoint) and **#10 is process, not code**. Both are marked below.

1. ⬜ **Verify production's puzzle chain and schema** (`db/verify-round-2.sql`,
   `db/identify-content-revision.sql` against Supabase). Everything else is secondary to knowing
   whether the live database can actually be played. *(P0-1)* — **still open; needs you.**
2. ✅ **Add the live-round interlock to PURGE.** Copy it from RESTART. One action currently ends the
   event irrecoverably. *(P0-2)*
3. ✅ **Decide and enforce the Round 2 vote rule.** Either allow voting after END, or make "do not end
   Round 02 until everyone has voted" an explicit runbook step. *(P1-1)* — **voting now survives
   END.**
4. ✅ **Guard `applyQualification` on `ROUND_1 === ENDED` and `ROUND_2 === PENDING`.** *(P1-2)*
5. ✅ **Add `error.tsx` and `global-error.tsx`.** A database blip currently shows a team Next's default
   error page. *(P1-3)*
6. ✅ **Add `import "server-only"` to `catalogue.ts`.** One line; converts your answer confidentiality
   from a convention into a compile-time guarantee. *(P2-1)* — **proved by making a client import
   fail the build.**
7. ✅ **Decide Round 2's hint policy, and add one per-team unstick action** writing a
   `MANUAL_ADJUSTMENT` event. Without it the operator's only levers are global and destructive.
   *(P4-1, P4-3)* — **the lever exists; the hint-control half of P4-1 is still a copy decision.**
8. ✅ **Fix `isUnarmedAnswer` to treat an empty answer as unarmed.** *(P4-2)*
9. ✅ **Add `loading.tsx` per participant route.** *(P1-4)*
10. ⬜ **Write down the production schema/migration path and tag the event commit.** *(P3-1, P3-5)*

Deliberately *not* in this list: CI, monitoring, labels, tablet breakpoints. They matter, but none of
them can end the event.

---

## EVENT-DAY CHECKLIST

Run in this order, from the operator laptop, with the deck open.

**T-60 minutes — infrastructure**
- [ ] Confirm the deployed site is on the intended commit (`git log --oneline -1` vs Vercel
      deployment).
- [ ] `curl -s https://<site>/api/health` → `{"ok":true,"db":{"status":"up"}}` and note `latencyMs`.
- [ ] Confirm the venue AP is up, on 5 GHz, and that a test phone gets a real page load.
- [ ] Load `/admin` on the operator laptop **and** on a phone; confirm both render.

**T-45 — content (the step that actually decides the event)**
- [ ] Run `db/verify-round-2.sql` against **production**. Expect `still_unarmed_in_round_2 = 0` and a
      code list of exactly `S1, S3, S4, S5, S6, S7, S8, LAST`.
- [ ] Run `db/identify-content-revision.sql` against production; confirm the revision is the one you
      rehearsed.
- [ ] Confirm the physical props for each link are present and match the titles in the catalogue
      (`props/s7/` holds the S7 QR assets and print sheet).

**T-30 — credentials**
- [ ] `credentials/event-access-codes.csv` is in hand and printed. It is the only plaintext copy —
      the database stores scrypt hashes and cannot regenerate it.
- [ ] One test unit logs in end-to-end and reaches `/lobby`.

**T-15 — dry run**
- [ ] Log in as a test unit, solve link 1, confirm the next link unlocks and the storyline badge
      increments.
- [ ] Open Round 01 from the deck with `CONFIRM`; confirm the clock starts and a phone shows the
      countdown.
- [ ] Confirm the deck shows **no** unarmed Round 2 links.

**T-0 — go**
- [ ] Distribute slips. Watch the deck's unit count as teams log in.
- [ ] Keep `db-status.mjs` running in a loop.

**During Round 01**
- [ ] Do **not** press "Qualify top 15" until Round 01 has ended.
- [ ] Watch for a team stuck on the same link for more than ~8 minutes; that is your cue to check
      whether the puzzle is ambiguous.

**Round 01 → Round 02 transition**
- [ ] End Round 01 from the deck (or let it expire).
- [ ] **Then** press "Qualify top 15". Confirm the deck reports the top 15 and Round 02 shows
      qualified units.
- [ ] Confirm the 45 eliminated units see the "did not qualify" panel, not an error.

**Round 02 and the vote**
- [ ] Ending Round 02 closes *submissions* but **not** the ballot. A unit that broke `LAST` can still
      seal its verdict after the round ends, so ending on time no longer locks anyone out of the
      finale. *(P1-1 — fixed)*
- [ ] Watch the deck's vote count climb; a unit that solved `LAST` but has not voted is the one to
      chase.
- [ ] Reveal the culprit only **after** you have told the room the ballot is closed. Votes keep being
      accepted until the event is restarted, so an early reveal invites late verdicts. Restarting or
      purging returns Round 02 to PENDING, which is what actually closes the ballot.

**If something goes wrong**
- [ ] A team stuck on a link → `/admin/teams/<id>` → **Repair — open one link**. Awards no points,
      retracts none, leaves wrong-answer penalties, touches no other unit, and is recorded in both
      the unit's ledger and the audit trail. *(P4-3 — fixed)*
- [ ] Deck unreachable → `scripts/reset-rounds.sql` is the documented fallback.
- [ ] Bad deploy → Vercel → Deployments → previous → Promote.

---

## PRE-EVENT TEST PLAN

**1. One participant**
- Log in with a real slip. Reach `/lobby`. Confirm the round shows "Awaiting go-signal".
- Switch all three tabs. Confirm the storyline badge behaves and the suspects board renders.
- Submit a wrong answer → confirm the penalty message, the 30 s lockout badge, and that the input
  disables for the lockout duration.
- Submit the correct answer → confirm the success message, the storyline signal, and that the next
  link unlocks **without a manual refresh**.
- Type an answer, wait 10 s (through an `AutoRefresh` cycle), confirm your typing is still there.

**2. Multiple participants (3 phones, one round live)**
- Confirm all three see the same round clock within a second.
- Have all three submit correct answers within the same second. Confirm each gets exactly one
  `PUZZLE_SOLVED` score event (check `/admin/teams/[id]` ledger for each).
- Have one team submit the same correct answer twice rapidly. Confirm the second returns
  "already solved" and no second score event is written.

**3. Multiple simultaneous submissions (the burst)**
- With 10+ phones, fire correct answers simultaneously. Confirm no 5xx, and that
  `/api/health` `latencyMs` stays in single digits.
- Watch the deck's unit table; confirm no team shows a phantom double-advance.

**4. One admin**
- Start Round 01 with `CONFIRM`. Confirm the round clock appears on phones within one refresh.
- Attempt to start Round 02 before qualifying → expect "No qualified units".
- Attempt to start a round with a deliberately unarmed link (on a scratch copy) → expect the refusal
  naming the link and its position.

**5. Mobile**
- Test at 320, 375, 390, 430 px. Confirm no horizontal scroll, no clipped tables, and that the bottom
  nav never covers the submit button.
- Test at 768 px specifically — this is the weakest width (P8-1).
- Confirm the answer input is at least 16 px (it is, below `sm`) so iOS does not zoom on focus.

**6. Refresh / reconnect**
- Mid-round, hard-refresh a phone. Confirm the team lands back on the same link with the same state.
- Turn off WiFi for 30 s, restore it. Confirm the page recovers on the next `AutoRefresh`.
- Open the same team in two browsers. Confirm the second login invalidates nothing and both work.

**7. Incorrect answers**
- 6 wrong answers on one link. Confirm the penalty caps at 50 and further wrong answers deduct 0 but
  still lock out 30 s.
- Confirm a locked-out team cannot submit, and that the lockout is enforced **server-side** (submit
  via a crafted request during lockout — expect `LOCKOUT`).

**8. Correct answers**
- Confirm the hint button appears only on unlocked puzzles and that claiming a hint deducts exactly
  30 and reveals exactly one hint.
- Confirm Round 02 shows **no** hint affordance (expected, per P4-1 — verify it is deliberate).

**9. Round transitions**
- End Round 01. Confirm phones show the ended state and that submissions are refused with
  "Official time has expired" / "not live".
- Run "Qualify top 15". Confirm exactly 15 units get Round 02 access and 45 get the eliminated panel.
- Run it a **second** time. Confirm the roster is unchanged and no team is ejected.

**10. Final vote**
- Solve `LAST`. Confirm the suspects board unlocks the vote.
- Vote. Confirm the ballot is sealed and a second vote is refused.
- **End Round 02, then attempt a vote from another qualified unit.** This currently fails — confirm
  you have decided that is intended, or fix P1-1.

---

## WHAT NOT TO CHANGE

These are correct, verified, and rewriting them would be a net loss.

1. **Answer confidentiality.** Verified by grepping the production client bundle: `NIGHTOWL`,
   `VIKRAM_SHETTY`, `DELETED`, `expectedAnswerNormalized` and `UNARMED_SENTINEL` each appear in **0**
   files under `.next/static`. The server/client boundary holds. Do not restructure it to "simplify"
   data flow.
2. **`SELECT … FOR UPDATE` in `submitAnswer`.** This is what makes simultaneous submissions safe.
   `engine.ts:356-361`. Do not replace it with an optimistic check.
3. **The one-vote-per-team database constraint.** `uq_culprit_votes_team` plus
   `onConflictDoNothing().returning()` in `castVote` is a correct, race-free idempotency pattern.
4. **The DB-backed sign-in throttle.** `auth_throttle` is deliberately not a module-level `Map`, and
   the primary budget hangs off the credential rather than the IP. The comment in `schema.ts:350-357`
   explains exactly why. The 240 → 600 room-scale change is the right shape; do not revert it to a
   per-IP attempt counter.
5. **`startRound` failing closed on unarmed content.** `engine.ts:863-891` is the single most valuable
   safety feature in the codebase. Extend it; never bypass it.
6. **`de1fc4d`** — the culprit ballot uses native radios so a selection survives a page whose client
   bundle did not run. Do not convert it back to `useState` buttons.
7. **Per-route authorization with `requireTeam`/`requireAdmin`.** All routes are guarded; `teamId`
   always comes from the session, never from form data. Do not introduce a `middleware.ts` that
   duplicates this without removing the page-level checks.
8. **`logAudit` swallowing its own failures.** Telemetry must never break gameplay. `audit/log.ts:33`.
9. **The graduated confirmation phrases** (`CONFIRM` / `RESTART` / `PURGE`). Add the missing interlock
   to PURGE; do not weaken the phrases.
10. **`/leaderboard`'s inert redirect.** It deliberately holds no query so a bookmarked link cannot
    leak a score. `tests/navigation/participant-surfaces.test.ts` guards this. Leave it.
11. **The `useSyncExternalStore` storyline cursor.** The server-snapshot-first pattern is what avoids
    a hydration mismatch, and the `storage` listener is what keeps two phones of the same unit in
    step. `use-storyline-read.ts`.
12. **`props/s7/` and the `S2` code gap.** `S2` is retired by design, documented in
    `db/identify-content-revision.sql` and `README.md:43`. Do not "fix" the numbering.
