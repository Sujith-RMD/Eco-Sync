import type { Metadata } from "next";
import { requireTeam } from "@/lib/auth/guards";
import { getTeamRoundSnapshot } from "@/server/game/engine";
import { RoundShell, RoundStateView } from "@/components/game/round-states";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 01 — The Breach",
};

export default async function RoundOnePage() {
  const { team } = await requireTeam();
  const result = await getTeamRoundSnapshot(team.id, team.name, "ROUND_1");

  return (
    <RoundShell eyebrow="Round 01 // 60 units // top 15 advance" title="THE BREACH" teamName={team.name}>
      <RoundStateView result={result} />
    </RoundShell>
  );
}
