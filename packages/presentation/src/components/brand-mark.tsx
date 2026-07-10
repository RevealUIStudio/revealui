import type React from 'react';

export interface RevealUIMarkProps {
  /** Sizing + colour utilities. The letterform inherits `currentColor`. */
  className?: string;
  /** Render the Solar Amber outline stroke. Default `true`. Set `false` for a single-colour mono mark (best at very small sizes). */
  reveal?: boolean;
  /** Accessible title. When omitted the mark is decorative (`aria-hidden`). */
  title?: string;
}

/**
 * The RevealUI logomark — a faceted "R" outlined in Solar Amber.
 *
 * The letterform inherits `currentColor`, so it adopts the brand/text colour of
 * its context (`text-primary`, or `--tenant-brand-on` inside branded shells),
 * which keeps it legible on any surface. The amber outline tracks the
 * `--rvui-accent` token. Canonical SVG masters (mark, mono, favicon, icon tile,
 * and the outlined-Inter-Tight lockups) live in `src/assets/brand/`.
 */
export function RevealUIMark({
  className,
  reveal = true,
  title,
}: RevealUIMarkProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 82 100"
      className={className}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g
        fill="currentColor"
        stroke={reveal ? 'var(--rvui-accent, #eeb300)' : 'none'}
        strokeWidth="3.4"
        strokeLinejoin="round"
      >
        <path d="M26 50 H44 L69 86 H51 L32 61 H26 Z" />
        <path
          fillRule="evenodd"
          d="M34 11 h13 a27 27 0 0 1 0 54 h-13 v-15 h12 a12 12 0 0 0 0 -24 h-12 z"
        />
        <path d="M17 11 h17 v75 h-17 z" />
      </g>
    </svg>
  );
}
