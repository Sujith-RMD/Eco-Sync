interface LogoMarkProps {
  className?: string;
}

/**
 * ECO-SYNC crest — the emblem half of the brand lockup supplied as
 * public/logo.png. The source is 529x472 and stacks an emblem (y 20-327) above
 * a wordmark band (y 369-435); only the emblem is used here, cropped square to
 * its ink bounds (309x308, ratio 1.003) so it fills the topbar slot with no
 * distortion. Dropping the wordmark is deliberate: it is 67 source pixels tall,
 * which is about 6px at this slot's 28px, and the event name is already set in
 * type beside this mark. The full lockup stays at /logo.png for large use.
 *
 * A plain <img> rather than next/image on purpose: self-hosted image
 * optimization needs `sharp`, which this project does not install, and a broken
 * logo during the event is worse than an unoptimized one. The 112px asset also
 * covers 3x-density phones at the largest size the topbar asks for.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={112}
      height={112}
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}
