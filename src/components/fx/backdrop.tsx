/**
 * Full-viewport atmospheric backdrop: the surface a case file sits on.
 *
 * Matte charcoal, a faint graphite grid, archive grain, and a vignette. It used
 * to be a blueprint grid under two blue radial glows, a drifting scan band and
 * a CRT scanline overlay — which is precisely the cyberpunk terminal the
 * interface is supposed to read against, and the single largest source of blue
 * in the product. None of that survives here.
 *
 * Pure CSS, no JS, and mounted on every surface (landing, both logins, lobby,
 * the team console, the admin deck, and the team loading state), so this file
 * carries most of the interface's perceived atmosphere. Keep it quiet: it is a
 * background, and the evidence on top of it is the thing worth looking at.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* graphite grid */}
      <div className="absolute inset-0 bg-gridlines mask-radial-fade" />

      {/*
        Ambient room light. Neutral rather than coloured, and shaped as a
        falloff rather than a blurred disc — it should read as low-key lighting
        on a matte surface, not as a glow sitting behind the content.
      */}
      <div className="absolute -top-56 left-1/2 h-[460px] w-[min(820px,92vw)] -translate-x-1/2 rounded-full [background:radial-gradient(closest-side,color-mix(in_oklab,var(--color-ink)_5%,transparent),transparent)]" />

      {/* archive grain — paper fibre, at the threshold of visibility */}
      <div className="absolute inset-0 bg-archive opacity-[0.035]" />

      {/* vignette */}
      <div className="absolute inset-0 [background:radial-gradient(120%_95%_at_50%_8%,transparent_42%,color-mix(in_oklab,var(--color-abyss-950)_92%,transparent)_100%)]" />
    </div>
  );
}
