interface LogoMarkProps {
  className?: string;
}

/** ECO-SYNC crest — containment hexagon with a leaf/core hybrid glyph. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
      role="presentation"
    >
      <path
        d="M16 2.6 27.6 9.3v13.4L16 29.4 4.4 22.7V9.3L16 2.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10.6 20.6c0-5 2.9-8 9.6-9.4-1.1 6.3-3.6 9.2-9.6 9.4Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M10.6 20.6c2.4-3.8 5-6.3 9.6-9.4"
        stroke="#03130d"
        strokeWidth="0.9"
      />
      <circle cx="22.1" cy="9.9" r="1.4" fill="currentColor" />
    </svg>
  );
}
