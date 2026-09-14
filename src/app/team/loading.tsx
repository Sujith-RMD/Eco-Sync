import { Backdrop } from "@/components/fx/backdrop";
import { Topbar } from "@/components/layout/topbar";
import { Eyebrow } from "@/components/layout/eyebrow";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils/cn";

/**
 * Loading state for every participant route.
 *
 * One file, not six. A `loading.tsx` applies to its segment and everything
 * beneath it, so this covers both rounds and all three tabs — which is also why
 * it cannot drift apart from itself the way six copies would.
 *
 * Why it exists: `AutoRefresh` keeps the *current* page fresh, but tapping
 * STORYLINE / ANSWERS / SUSPECTS is a fresh server render, and every one of
 * these routes is `force-dynamic` with ~10 database round-trips behind it. On a
 * congested venue AP that gap is a visible dead tap, and a team that taps again
 * stacks a second request on top of the first.
 *
 * It mirrors the real shell's frame — same backdrop, topbar, container width and
 * bottom padding — so nothing jumps when the content lands. The identity strip
 * and tab bar are absent by necessity: both are built from server data, and
 * waiting for them is the thing being hidden. The copy is generic for the same
 * reason: a per-route title here would be a second copy of strings that already
 * live in the page files, free to drift out of sync.
 */
const BAR = "animate-pulse bg-line/50";

export default function TeamLoading() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />

      <Topbar>
        <StatusPill tone="muted" label="syncing" />
      </Topbar>

      <main className="relative z-10 mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pb-[7.5rem] pt-6 sm:px-8 sm:pb-10 lg:pb-12 lg:pt-8">
        <Eyebrow>Reading the chain</Eyebrow>

        {/* The one thing a screen reader needs to hear. */}
        <p role="status" className="sr-only">
          Loading this round.
        </p>

        {/* Everything below is decorative. */}
        <div aria-hidden className="mt-3 mb-5 space-y-3 sm:mb-7">
          <div className={cn(BAR, "h-7 w-2/3 max-w-sm")} />
          <div className={cn(BAR, "h-3 w-40")} />
        </div>

        <div aria-hidden className="space-y-4">
          {[0, 1].map((panel) => (
            <div
              key={panel}
              className="relative border border-line/80 bg-abyss-900/70 backdrop-blur-md"
            >
              <div className="border-b border-line/70 px-3.5 py-3 sm:px-5 sm:py-3.5">
                <div className={cn(BAR, "h-2.5 w-32")} />
              </div>
              <div className="space-y-3 px-3.5 py-4 sm:px-5 sm:py-5">
                <div className={cn(BAR, "h-3 w-full")} />
                <div className={cn(BAR, "h-3 w-11/12")} />
                <div className={cn(BAR, "h-3 w-3/4")} />
                <div className={cn(BAR, "h-9 w-full max-w-xs")} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
