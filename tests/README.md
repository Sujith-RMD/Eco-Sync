# Tests

Engine rule suites run on **Vitest** (no React rendering, no database
required — rules are pure functions):

```bash
npx vitest run
```

| Suite | Covers (spec §26) |
| --- | --- |
| `tests/engine/rules.test.ts` | Correct/incorrect normalization, permissiveness guard, repeated wrong answers, −50 per-puzzle cap, hint cost constant, +2/full-minute bonus, 830 maximum, simulated full-run score math, qualification ordering, tie-breaks, Round 2 winner ordering, water-data A1Z26 decoding |
| `tests/engine/catalogue.test.ts` | Round 1 chain integrity (P1→P7, 100/150 points), Round 2 supplied progression (S1→ENV_A→S2→ENV_B→S3→S4→S5→S6→S7→S8→FINAL), envelope checkpoint semantics, anchor consistency, suspect roster validity, duplicate/strict suspect codes |

Server-authoritative behaviors that require a live database (lockout
enforcement, timer expiry handling, refresh persistence, duplicate-vote
rejection at the unique-constraint level, Round 1 completion, qualification
application, Round 2 access gating) are implemented in
`src/server/game/engine.ts` with transactional row locking and verified via
the admin command deck flows during rehearsals.
