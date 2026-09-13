/**
 * Full-viewport atmospheric backdrop: blueprint grid, ambient glows,
 * a drifting scan band, CRT scanlines, and a vignette. Pure CSS, no JS.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* blueprint grid */}
      <div className="absolute inset-0 bg-gridlines mask-radial-fade" />
      {/* ambient glows */}
      <div className="absolute -top-44 left-1/2 h-[420px] w-[min(720px,90vw)] -translate-x-1/2 rounded-full bg-acid/10 blur-[140px] animate-flicker" />
      <div className="absolute -bottom-44 -right-32 h-[380px] w-[520px] rounded-full bg-pulse/10 blur-[130px]" />
      {/* drifting scan band */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[13%] bg-gradient-to-b from-transparent via-acid/[0.055] to-transparent animate-scan-band" />
      </div>
      {/* CRT scanlines */}
      <div className="absolute inset-0 bg-scanlines opacity-70" />
      {/* vignette */}
      <div className="absolute inset-0 [background:radial-gradient(120%_95%_at_50%_8%,transparent_42%,color-mix(in_oklab,var(--color-abyss-950)_92%,transparent)_100%)]" />
    </div>
  );
}
