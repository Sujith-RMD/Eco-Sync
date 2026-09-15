# ECO-SYNC: THE BREACH — Cryptic Room

Production-grade multiplayer escape-room / cybersecurity investigation
platform for a live event: **61 teams → Round 1 (top 15 qualify) →
Round 2 (top 3 win) → sealed culprit vote.**

All phases are implemented: foundation, server-authoritative game engine,
Round 1 and Round 2 team consoles, admin command deck, qualification,
final code, culprit voting, live leaderboard, and the engine rule
test-suite.

---

## Stack

- **Next.js (App Router) + React 19 + strict TypeScript**
- **Tailwind CSS v4** — dark ops-console design system
- **PostgreSQL via Drizzle ORM** *(spec named Prisma; the managed
  deployment environment provisions Drizzle — schema is modeled 1:1 in
  [`src/db/schema.ts`](src/db/schema.ts))*
- Server actions + route handlers; every mutation is server-validated
- Database-backed sessions (httpOnly cookies, SHA-256 token-at-rest,
  scrypt credential hashing)

## Security model (never bypassed)

- The client is **never** authoritative for answers, score, progression,
  timers, lockouts, qualification, or votes.
- Puzzle answers/hint payloads live only in `[SERVER-ONLY]` DB columns and
  in `src/server/game/catalogue.ts` (import-discipline: server modules
  only). Client DTOs filter briefings/hints by unlock state.
- Submissions run in DB transactions with `SELECT … FOR UPDATE` row locks,
  unique-constraint backstops (one progress row per team+puzzle, one vote
  per team), and immutable `score_events` ledger entries.
- Server clock (round `startedAt`/`endsAt`) drives timers, expiry checks,
  lockouts (30 s), and the +2/minute time bonus. Client countdowns are
  cosmetic.

## Game content (from the supplied documents)

- **Round 1** — 10 sequential puzzles, 40:00, +100 per puzzle (+150 final),
  hint −30, wrong −10 capped at −50/puzzle, +2/full minute. Max 1130.
  P8/P9 carry their evidence inline as an `[IMG:…]` briefing line. P7
  RECOVERED TRANSMISSION hands the team an external link once solved; the
  snapshot exposes it on `SOLVED` only, because the URL contains the answer.
- **Round 2** — 8 links in play order: S1 → S3 → S4 → S5 → S6 → S7 → S8 →
  `LAST` (the 150-point final code) → sealed culprit vote, 75:00. S7 is a
  physical prop pair (`props/s7/`); its answer is authored and the QR codes are
  generated from it, not read off them.
- Tie-breaks: score → earlier finish → fewer wrong penalties → fewer hints
  → stable id. Round 2 winners: earliest final-code solve, then depth.

## Architecture

```
src/
  app/        landing · login · admin/(login, overview, teams, teams/[id],
              leaderboard, votes, audit) · lobby · team/round-1 · team/round-2
              (each with storyline/ and suspects/ tabs) · leaderboard (legacy
              redirect — holds no query) · api/health
  components/ ui/ · layout/ · brand/ · fx/ · auth/ · game/ (round console,
              timer, vote panel, briefing text) · team/ (shell, tabs, nav,
              case file, suspects, unlock notice) · admin/ (shell, controls)
  lib/        auth/ (password, session, guards) · security/ (rate-limit,
              request, sign-in throttle) · storyline/ (beats, read-state,
              signal) · team/ · validation/ · utils/
  server/     auth/ · admin/ · team/ · audit/ · game/ (engine, rules,
              catalogue, constants, seed, content-guard, unarmed)
  db/         schema.ts · index.ts · connection-config.ts · supabase-root-ca.ts
  types/      client-safe DTOs only
tests/        vitest suites — 80 tests across 8 files (rules, catalogue,
              content-guard, connection-config, event time, sign-in throttle,
              participant-surface separation, case-file derivation)
props/        printable physical props (s7/)
scripts/      seed-event.ts · smoke.ts (destructive rehearsal) ·
              apply-round1-content.ts (writes the Round 1 chain) ·
              apply-roster.ts (UNIT-NN → TEAM#XXXX) · generators
```

## Commands

```bash
npm install                # dependencies
npx drizzle-kit push       # apply schema to PostgreSQL
npm run dev                # develop
npx vitest run             # engine rule tests
npx next typegen           # route/type generation check
npx tsc --noEmit           # strict typecheck
npm run build              # production build
npm run start              # serve production build
```

## Event operations

1. Deploy, apply schema, open `/admin` → **Initialize event** (creates the
   two rounds, the full supplied puzzle catalogue, 61 team accounts with
   per-team access codes, and one operator). Credentials are shown once and
   exportable as CSV — access codes are stored only as hashes.
2. Teams sign in at `/login` → `/lobby` → Round 01 console. The login ID is
   the `TEAM#XXXX` designation printed on the check-in slip.
3. Command deck controls: **Start/End Round 01 → Qualify top 15 →
   Start/End Round 02**, teams registry, per-team detail (progression,
   attempts, ledger), final rankings, vote audit, full audit trail.
   Dangerous actions require typed confirmation and are audited.
4. **Restart event** (danger zone) wipes all play data — scores, attempts,
   hints, verdicts, qualifications — and returns both rounds to `PENDING`, so
   the **same 61 access codes** can run the event again. Every team is signed
   out and logs back in with the slip they already hold. Guarded: refused while
   a round is live, and requires typing `RESTART`.
5. **Full purge** (collapsed inside the same card) additionally deletes the
   round rows, puzzle chain, team accounts and access codes — use it to build a
   brand-new event, then re-seed and re-print codes. Both actions preserve
   operators and the audit trail.

## Environment variables

See [`.env.example`](.env.example). `DATABASE_URL` (required),
`SESSION_TTL_HOURS` (optional, default 12), `FIRST_RUN_SEED_TOKEN` (optional;
required by the `/admin` seed form while zero operators exist — unset locks
that path and the CLI becomes the only first-run seeder).
