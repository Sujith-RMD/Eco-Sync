import type { Metadata } from "next";
import { StorylineTab } from "@/components/team/participant-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Round 01 — Case File",
};

export default function RoundOneStorylinePage() {
  return (
    <StorylineTab
      round="ROUND_1"
      meta={{
        eyebrow: "Round 01 // what we know",
        title: "CASE FILE",
      }}
    />
  );
}
