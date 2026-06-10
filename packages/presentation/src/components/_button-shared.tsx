import type React from 'react';
import { cn } from '../utils/cn.js';

/**
 * Shared button internals — a single source of truth for the visual bits used
 * by both the CVA `Button` (Button.tsx) and `LinkButton` (LinkButton.tsx), so
 * the two stay in lockstep instead of drifting via copy-paste.
 *
 * Pure presentation: an SVG, plain constants, and one decorative element. No
 * hooks and no `'use client'` — safe to render in React Server Components, so
 * the server-exported `ButtonCVA` keeps working.
 */

/**
 * Loading spinner. `aria-hidden` because the busy state is announced by the
 * host control's `aria-busy`; the spinner is purely decorative. Defaults to
 * `size-4 animate-spin`, both overridable via `className`.
 */
export function Spinner({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>): React.ReactElement {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Token-driven inline style shared by Button and LinkButton: rounded corners
 * from `--rvui-radius-md`, and a transition scoped to exactly the properties
 * that change on interaction (color / background / border / shadow / transform)
 * — never `all`, which would also animate layout and cause jank.
 */
export const buttonTransitionStyle: React.CSSProperties = {
  transitionProperty: 'color, background-color, border-color, box-shadow, transform',
  transitionDuration: 'var(--rvui-duration-normal, 200ms)',
  transitionTimingFunction: 'var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))',
  borderRadius: 'var(--rvui-radius-md, 10px)',
};

/**
 * Opt-in brand-glow halo for emphasis CTAs. Driven entirely by the
 * `--rvui-shadow-glow` design token (a soft halo in the active brand hue), so
 * it re-themes automatically with the brand. Held on hover so the CTA keeps
 * glowing while pointed at.
 */
export const glowClasses =
  'shadow-[var(--rvui-shadow-glow)] hover:shadow-[var(--rvui-shadow-glow)]';

/**
 * Classes applied to the host *element* to carry the {@link ShineOverlay}: an
 * isolated stacking context (so the overlay's `-z-10` lands above the
 * background but below the label), clipping for the sweep, and a `group` so the
 * overlay can react to the host's hover.
 */
export const shineHostClasses = 'group relative isolate overflow-hidden';

/**
 * Decorative light sweep that animates across the control on hover. Rendered as
 * an `aria-hidden`, non-interactive sibling of the label at `-z-10` — above the
 * host background, below the text. Pair with {@link shineHostClasses} on the
 * host element. Box-shadows (focus ring, {@link glowClasses}) are unaffected by
 * the host's `overflow-hidden` since they paint outside the border box.
 */
export function ShineOverlay(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
    />
  );
}
