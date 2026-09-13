import type { Metadata } from "next";
import { SuspectsTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 02 — Suspects",
};

export default function RoundTwoSuspectsPage() {
  return (
    <SuspectsTab
      round="ROUND_2"
      meta={{
        eyebrow: "Round 02 // the insider is among them",
        title: "SUSPECTS",
      }}
    />
  );
}
