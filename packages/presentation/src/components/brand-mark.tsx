import type React from 'react';

export interface RevealUIMarkProps {
  /** Sizing + colour utilities. The letterform inherits `currentColor`. */
  className?: string;
  /** Render the Solar Amber aperture pupil. Default `true`. Set `false` for a single-colour mono mark (best at very small sizes). */
  reveal?: boolean;
  /** Accessible title. When omitted the mark is decorative (`aria-hidden`). */
  title?: string;
}

/**
 * The RevealUI logomark — a faceted "R" with a circular aperture counter and a
 * Solar Amber pupil (the "reveal" lens).
 *
 * The letterform inherits `currentColor`, so it adopts the brand/text colour of
 * its context (`text-primary`, or `--tenant-brand-on` inside branded shells),
 * which keeps it legible on any surface. The amber pupil tracks the
 * `--rvui-accent` token. Canonical SVG masters (mark, mono, favicon tile, and
 * the outlined-Inter-Tight lockups) live in `src/assets/brand/`.
 */
export function RevealUIMark({
  className,
  reveal = true,
  title,
}: RevealUIMarkProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g fill="currentColor">
        <path d="M16 12 H38 V88 H16 Z" />
        <path
          fillRule="evenodd"
          d="M34 12 L56 12 L66 22 L66 41 L56 51 L34 51 Z M61 31 A12 12 0 1 1 37 31 A12 12 0 1 1 61 31 Z"
        />
        <path d="M34 49 L54 49 L70 88 L50 88 Z" />
      </g>
      {reveal ? <circle cx="49" cy="31" r="5" fill="var(--rvui-accent, #eeb300)" /> : null}
    </svg>
  );
}
