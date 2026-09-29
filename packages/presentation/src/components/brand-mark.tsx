import type React from 'react';
import { cn } from '../utils/cn.js';

export interface RevealUIMarkProps {
  /** Sizing utilities. The mark is the kit master asset, not a recolored letter. */
  className?: string;
  /**
   * Accepted for existing call sites. The kit master already includes the amber
   * vias, so this does not swap in a second letterform.
   */
  reveal?: boolean;
  /** Accessible name. When omitted the mark is decorative (`aria-hidden`). */
  title?: string;
}

/**
 * Public copies of the kit master in `src/assets/brand/`.
 * `revealui-logo.svg` and `revealui-logo-dark.svg` are the same bytes.
 * No invert. No inline path data.
 */
const CIRCUIT_R_MASTER_LIGHT_SRC = '/revealui-logo.svg';
const CIRCUIT_R_MASTER_DARK_SRC = '/revealui-logo-dark.svg';

/**
 * The RevealUI logomark. Renders the kit Circuit-R master asset.
 * Light and dark files are the same bytes. Size comes from `className` only.
 */
export function RevealUIMark({
  className,
  reveal: _reveal = true,
  title,
}: RevealUIMarkProps): React.JSX.Element {
  const marks = (
    <>
      {/* biome-ignore lint/performance/noImgElement: kit master asset, not a Next image */}
      <img
        src={CIRCUIT_R_MASTER_LIGHT_SRC}
        alt=""
        data-circuit-r="light"
        className="block h-full w-auto max-w-none"
      />
      {/* biome-ignore lint/performance/noImgElement: dark file is the same kit master bytes */}
      <img
        src={CIRCUIT_R_MASTER_DARK_SRC}
        alt=""
        data-circuit-r="dark"
        className="absolute inset-0 block h-full w-auto max-w-none"
      />
    </>
  );

  if (!title) {
    return (
      <span className={cn('relative inline-block', className)} aria-hidden>
        {marks}
      </span>
    );
  }

  return (
    <span className={cn('relative inline-block', className)} role="img" aria-label={title}>
      {marks}
    </span>
  );
}
