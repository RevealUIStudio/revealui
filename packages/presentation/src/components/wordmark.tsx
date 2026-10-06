import type React from 'react';
import { cn } from '../utils/cn.js';
import { RevealUIMark } from './brand-mark.js';

const PRODUCT_WORDMARK = 'RevealUI';

export interface RevealUIWordmarkProps {
  /** Sizing + layout utilities on the outer wrapper. Font size drives the whole lockup. */
  className?: string;
  /** Accepted for existing call sites. Does not swap in a second letterform. */
  reveal?: boolean;
  /**
   * Visible wordmark. Defaults to "RevealUI".
   * The Studio site (separate repo) passes "RevealUI Studio" so its header
   * is not the same lockup as the product. The Circuit-R mark stays the
   * transparent kit master: no tile and no plate behind it.
   */
  label?: string;
}

/**
 * The RevealUI wordmark: the Circuit-R monogram plus "RevealUI" set in the
 * brand display face.
 *
 * The "RevealUI" text is real HTML, not SVG `<text>`: SVG text does not
 * inherit page fonts in `<img>`/favicon contexts (it falls back to an
 * arbitrary system font), so this is the reliable way to get the display
 * face applied. "Reveal" tracks `--rvui-brand-text` and "UI" tracks
 * `--rvui-warning-text` (the AA text step in the amber family). The accent
 * fill is about 1.93:1 on the light header and fails axe. Both tokens flip
 * with the light and dark ladders in `@revealui/tokens`. No theme prop
 * needed. The
 * monogram is `RevealUIMark`, which renders the kit master asset. Light and
 * dark files are the same bytes. See `src/assets/brand/` for the source of truth.
 */
function WordmarkLabel({ label }: { label: string }): React.JSX.Element {
  const brandText = 'var(--rvui-brand-text, #003d94)';
  const usesProductName = label === PRODUCT_WORDMARK || label.startsWith(`${PRODUCT_WORDMARK} `);
  if (!usesProductName) {
    return <span style={{ color: brandText }}>{label}</span>;
  }
  const suffix = label.slice(PRODUCT_WORDMARK.length);
  return (
    <>
      <span style={{ color: brandText }}>Reveal</span>
      <span style={{ color: 'var(--rvui-warning-text, #6b4a00)' }}>UI</span>
      {suffix.length > 0 ? <span style={{ color: brandText }}>{suffix}</span> : null}
    </>
  );
}

export function RevealUIWordmark({
  className,
  reveal = true,
  label = PRODUCT_WORDMARK,
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
        <WordmarkLabel label={label} />
      </span>
    </span>
  );
}
