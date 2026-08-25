import type React from 'react';
import { cn } from '../utils/cn.js';
import { RevealUIMark } from './brand-mark.js';

export interface RevealUIWordmarkProps {
  /** Sizing + layout utilities on the outer wrapper. Font size drives the whole lockup. */
  className?: string;
  /** Render the Solar Amber outline stroke on the monogram. Default `true`. */
  reveal?: boolean;
}

/**
 * The RevealUI wordmark — the Circuit-R monogram plus "RevealUI" set in the
 * brand display face.
 *
 * The "RevealUI" text is real HTML, not SVG `<text>`: SVG text does not
 * inherit page fonts in `<img>`/favicon contexts (it falls back to an
 * arbitrary system font), so this is the reliable way to get the display
 * face applied. "Reveal" tracks `--rvui-brand-text` and "UI" tracks
 * `--rvui-accent`, both of which flip automatically between the light and
 * dark token ladders in `@revealui/tokens` — no theme prop needed. The
 * monogram is the same canonical paths as `RevealUIMark`; see that
 * component and `src/assets/brand/` for the source of truth.
 */
export function RevealUIWordmark({
  className,
  reveal = true,
}: RevealUIWordmarkProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-[0.2em] text-2xl', className)}>
      <RevealUIMark reveal={reveal} className="h-[1em] w-auto shrink-0" />
      <span
        className="font-extrabold tracking-tight"
        style={{
          fontFamily: 'var(--rvui-font-display, "Inter Tight", "Inter", system-ui, sans-serif)',
        }}
      >
        <span style={{ color: 'var(--rvui-brand-text, #003d94)' }}>Reveal</span>
        <span style={{ color: 'var(--rvui-accent, #eeb300)' }}>UI</span>
      </span>
    </span>
  );
}
