import type { Metadata } from "next";
import { requireTeam } from "@/lib/auth/guards";
import { getTeamRoundSnapshot } from "@/server/game/engine";
import { RoundShell, RoundStateView } from "@/components/game/round-states";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 02 — Culprit Trail",
};

export default async function RoundTwoPage() {
  const { team } = await requireTeam();
  const result = await getTeamRoundSnapshot(team.id, team.name, "ROUND_2");

  return (
    <RoundShell eyebrow="Round 02 // 15 units // 3 prevail" title="CULPRIT TRAIL" teamName={team.name}>
      <RoundStateView result={result} />
    </RoundShell>
  );
}
