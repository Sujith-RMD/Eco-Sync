import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bootedAt = Date.now();

/**
 * Liveness probe for the platform and for operators.
 * Reports only non-sensitive operational telemetry.
 */
export async function GET() {
  const probeStart = performance.now();
  let dbStatus: "up" | "down" = "up";

  try {
    await db.execute(sql`select 1`);
  } catch {
    dbStatus = "down";
  }

  const ok = dbStatus === "up";

  return Response.json(
    {
      ok,
      service: "ecosync-the-breach",
      phase: 1,
      db: {
        status: dbStatus,
        latencyMs: Math.max(0, Math.round(performance.now() - probeStart)),
      },
      uptimeSec: Math.round((Date.now() - bootedAt) / 1000),
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
