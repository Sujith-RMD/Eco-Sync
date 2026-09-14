import { redirect } from "next/navigation";
import { getSessionView } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Standings",
};

/**
 * Standings are operator-facing only, so this historical URL keeps no data of
 * its own — it resolves the session and sends each subject to where they belong.
 *
 * The route exists solely so a bookmarked or printed `/leaderboard` link cannot
 * dead-end a team mid-round; nothing below can render a score, because nothing
 * here calls a standings query at all. Operators land on the command-deck board,
 * teams go back to their lobby, and an anonymous visitor is asked to identify
 * itself first — a hall screen with no session gets a login page, not a feed.
 */
export default async function LegacyStandingsPage() {
  const session = await getSessionView();
  if (session?.subject === "ADMIN") redirect("/admin/leaderboard");
  if (session?.subject === "TEAM") redirect("/lobby");
  redirect("/login");
}
