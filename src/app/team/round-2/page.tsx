import type { Metadata } from "next";
import { AnswersTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 02 — Culprit Trail",
};

export default function RoundTwoAnswersPage() {
  return (
    <AnswersTab
      round="ROUND_2"
      meta={{
        eyebrow: "Round 02 // 15 teams // 3 prevail",
        title: "CULPRIT TRAIL",
      }}
    />
  );
}
