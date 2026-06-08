import type React from 'react';

export interface RevealUIMarkProps {
  /** Sizing + colour utilities. The letterform inherits `currentColor`. */
  className?: string;
  /** Render the Solar Amber "reveal" stripe on the leg. Default `true`. Set `false` for a single-colour mono mark (best at very small sizes). */
  reveal?: boolean;
  /** Accessible title. When omitted the mark is decorative (`aria-hidden`). */
  title?: string;
}

/**
 * The RevealUI logomark — a geometric "R" with a Solar Amber "reveal" stripe.
 *
 * The letterform inherits `currentColor`, so it adopts the brand/text colour of
 * its context (`text-primary`, or `--tenant-brand-on` inside branded shells),
 * which keeps it legible on any surface. The amber stripe tracks the
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
      {reveal ? (
        <path d="M36 54 L48 54 L64 84 L52 84 Z" fill="var(--rvui-accent, #eeb300)" />
      ) : null}
      <g fill="currentColor">
        <rect x="24" y="18" width="15" height="66" rx="3" />
        <path
          fillRule="evenodd"
          d="M70 38 A21 21 0 1 1 28 38 A21 21 0 1 1 70 38 Z M58 38 A9 9 0 1 1 40 38 A9 9 0 1 1 58 38 Z"
        />
        <path d="M42 54 L57 54 L74 84 L59 84 Z" />
      </g>
    </svg>
  );
}
