/**
 * One-off event bootstrap for a live database.
 *
 * This exists because the "Initialize event" form is only rendered inside the
 * auth-protected command deck (AdminControls on /admin), while the operator
 * account that form creates is itself the prerequisite for that session — so a
 * freshly pushed schema cannot be seeded through the UI. The server action
 * (seedEventAction) already permits an unauthenticated first run; this script
 * is the CLI equivalent of that same first-run path.
 *
 * Usage (PowerShell):
 *
 *   $env:OPERATOR_ID        = "command"           # 3-40 chars, [a-zA-Z0-9_.-]
 *   $env:OPERATOR_PASSPHRASE = "your-passphrase"  # >= 10 chars
 *   $env:CONFIRM_SEED       = "yes"
 *   $env:NODE_OPTIONS       = "--conditions=react-server"
 *   npx tsx scripts/seed-event.ts
 *
 * Credentials are read from the environment only — never hardcoded, and never
 * echoed to stdout. The generated team access codes are stored in the DB as
 * scrypt hashes and cannot be recovered afterwards, so they are written once to
 * a local CSV (gitignored).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pool } from "@/db";
import { seedEvent } from "@/server/game/seed";

const OUTPUT_DIR = "credentials";
const OUTPUT_FILE = "event-access-codes.csv";

/** Bad invocation input, as opposed to a genuine seeding failure. */
class SeedInputError extends Error {}

function requireConfirmation(): void {
  if (process.env.CONFIRM_SEED !== "yes") {
    throw new SeedInputError(
      'Refusing to seed without confirmation. Re-run with CONFIRM_SEED="yes".',
    );
  }
}

/**
 * Mirrors the seedSchema in src/server/admin/actions.ts so problems surface
 * here as clear text instead of as a rejected server action.
 */
function requireOperatorCredentials(): { username: string; password: string } {
  const username = process.env.OPERATOR_ID?.trim();
  const password = process.env.OPERATOR_PASSPHRASE;

  if (!username || !password) {
    throw new SeedInputError(
      "Missing operator credentials. Set both OPERATOR_ID and OPERATOR_PASSPHRASE.",
    );
  }
  if (username.length < 3 || username.length > 40) {
    throw new SeedInputError("Operator ID must be 3-40 characters.");
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    throw new SeedInputError(
      "Operator ID may contain only letters, digits, dot, underscore and hyphen.",
    );
  }
  if (password.length < 10 || password.length > 128) {
    throw new SeedInputError("Operator passphrase must be 10-128 characters.");
  }

  return { username, password };
}

async function main(): Promise<void> {
  requireConfirmation();
  const { username, password } = requireOperatorCredentials();

  console.log("Seeding event: rounds + puzzle catalogue + rostered teams + operator…");
  const result = await seedEvent({ adminUsername: username, adminPassword: password });

  const csv = [
    "team_id,access_code",
    ...result.teams.map((team) => `${team.name},${team.accessCode}`),
  ].join("\n");

  const dir = resolve(process.cwd(), OUTPUT_DIR);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, OUTPUT_FILE);
  writeFileSync(filePath, `${csv}\n`, { encoding: "utf8", mode: 0o600 });

  console.log("✓ Event initialized.");
  console.log(`  Operator ID : ${result.adminUsername}`);
  console.log(`  Teams       : ${result.teamCount}`);
  console.log(
    `  Puzzles     : ${result.puzzleCounts.round1} (Round 01) + ` +
      `${result.puzzleCounts.round2} (Round 02)`,
  );
  console.log(`  Codes CSV   : ${filePath}`);
  console.log("\n  Sign in at /admin/login with the operator ID and passphrase.");
  console.log("  Team codes appear only in the CSV above — they are unrecoverable.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof SeedInputError) {
      console.error(`\n✗ ${message}\n`);
    } else if (message.includes("EVENT_ALREADY_SEEDED")) {
      console.error(
        "\n✗ The event is already seeded. Use RESTART on the command deck to replay\n" +
          "  with the same access codes, or the FULL PURGE disclosure to rebuild\n" +
          "  the event from scratch.\n",
      );
    } else {
      console.error(`\n✗ Seed failed: ${message}\n`);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
