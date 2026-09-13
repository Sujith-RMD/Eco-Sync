import type { RoundCode } from "@/types/game";
import {
  loadTeamRoundContext,
  roundOpenedAt,
  roundStatusOf,
} from "@/lib/team/round-context";
import { TeamShell } from "@/components/team/team-shell";
import { RoundStateView } from "@/components/game/round-states";
import { StorylineView } from "@/components/team/storyline-view";
import { SuspectsBoard } from "@/components/team/suspects-board";

export interface TabMeta {
  eyebrow: string;
  title: string;
}

/**
 * The three participant tab bodies.
 *
 * Each one resolves the same context and wraps it in the same shell, so the
 * navigation, identity strip and unlock notice are identical everywhere — which
 * is the difference between three views of one interface and three pages that
 * slowly drift apart.
 */

export async function AnswersTab({
  round,
  meta,
}: {
  round: RoundCode;
  meta: TabMeta;
}) {
  const { teamName, result, bundle, progress } = await loadTeamRoundContext(round);
  return (
    <TeamShell
      round={round}
      active="answers"
      summary={bundle.summary}
      progress={progress}
      eyebrow={meta.eyebrow}
      title={meta.title}
      teamName={teamName}
    >
      <RoundStateView result={result} />
    </TeamShell>
  );
}

export async function StorylineTab({
  round,
  meta,
}: {
  round: RoundCode;
  meta: TabMeta;
}) {
  const { teamName, result, bundle, progress } = await loadTeamRoundContext(round);
  return (
    <TeamShell
      round={round}
      active="storyline"
      summary={bundle.summary}
      progress={progress}
      eyebrow={meta.eyebrow}
      title={meta.title}
      teamName={teamName}
    >
      <StorylineView
        beats={bundle.storyline?.beats ?? []}
        summary={bundle.summary}
        roundStatus={roundStatusOf(result)}
        progress={progress}
        openedAt={roundOpenedAt(result)}
      />
    </TeamShell>
  );
}

export async function SuspectsTab({
  round,
  meta,
}: {
  round: RoundCode;
  meta: TabMeta;
}) {
  const { teamName, result, bundle, progress } = await loadTeamRoundContext(round);
  return (
    <TeamShell
      round={round}
      active="suspects"
      summary={bundle.summary}
      progress={progress}
      eyebrow={meta.eyebrow}
      title={meta.title}
      teamName={teamName}
    >
      <SuspectsBoard
        round={round}
        vote={result.kind === "ready" ? result.snapshot.vote : undefined}
      />
    </TeamShell>
  );
}
