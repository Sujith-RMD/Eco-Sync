import type { Metadata } from "next";
import { SuspectsTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 01 — Suspects",
};

export default function RoundOneSuspectsPage() {
  return (
    <SuspectsTab
      round="ROUND_1"
      meta={{
        eyebrow: "Round 01 // persons of interest",
        title: "SUSPECTS",
      }}
    />
  );
}
