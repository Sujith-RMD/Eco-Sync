import type { Metadata } from "next";
import { StorylineTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 02 — Case File",
};

export default function RoundTwoStorylinePage() {
  return (
    <StorylineTab
      round="ROUND_2"
      meta={{
        eyebrow: "Round 02 // what we know",
        title: "CASE FILE",
      }}
    />
  );
}
