import { publicLeaderboard } from "@/server/game/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public, answer-free leaderboard feed (score/rank/progress only). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const round = searchParams.get("round") === "ROUND_2" ? "ROUND_2" : "ROUND_1";
  try {
    const data = await publicLeaderboard(round);
    return Response.json(
      { round, ...data, serverTime: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { round, status: null, rows: [], error: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
