import type { Metadata } from "next";
import { AnswersTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 01 — The Breach",
};

export default function RoundOneAnswersPage() {
  return (
    <AnswersTab
      round="ROUND_1"
      meta={{
        eyebrow: "Round 01 // 61 teams // top 15 advance",
        title: "THE BREACH",
      }}
    />
  );
}
