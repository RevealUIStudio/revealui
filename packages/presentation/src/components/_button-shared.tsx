import type React from 'react';
import { cn } from '../utils/cn.js';

/**
 * Shared button internals — a single source of truth for the visual bits used
 * by both `Button` (Button.tsx) and `LinkButton` (LinkButton.tsx), so the two
 * stay in lockstep instead of drifting via copy-paste.
 *
 * Pure presentation: an SVG, plain constants, a decorative element, and the
 * touch hit-area expander. No hooks and no `'use client'` — safe to render in
 * React Server Components, so the server-exported `Button` keeps working.
 */

/**
 * Loading spinner. `aria-hidden` because the busy state is announced by the
 * host control's `aria-busy`; the spinner is purely decorative. Defaults to
 * `size-4 animate-spin`, both overridable via `className`.
 *
 * The spin is retained under reduced motion: it is the one motion that
 * communicates in-progress state, and it is `aria-hidden` with `aria-busy`
 * carrying the semantics. The interaction motions (press-scale, hover
 * transition, shine sweep) are the ones the reduced-motion guard collapses.
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
 *
 * The sweep transition is collapsed under `prefers-reduced-motion: reduce` at
 * the CSS level (`motion-reduce:transition-none`), so no JS motion hook is
 * needed and this module stays RSC-safe.
 */
export function ShineOverlay(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:transition-none"
    />
  );
}

/**
 * Expand the interactive hit area to at least 44x44px on touch devices, per the
 * WCAG 2.5.5 target-size guidance. Renders an `aria-hidden` overlay sized to the
 * larger of the content box or 2.75rem, hidden on fine pointers where the visual
 * control is already the target. Shared by `Button`, `LinkButton`, and the
 * avatar / badge / nav / sidebar link surfaces.
 */
export function TouchTarget({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  );
}
