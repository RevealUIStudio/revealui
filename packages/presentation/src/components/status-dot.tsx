'use client';

import type React from 'react';
import { useReducedMotion } from '../animations/hooks/use-reduced-motion.js';
import { cn } from '../utils/cn.js';

export type StatusDotStatus = 'ok' | 'warn' | 'error' | 'idle';

/**
 * Semantic token per status. These are `--rvui-*` design tokens (not raw
 * Tailwind palette), so the dot tracks the Cobalt token system and adapts to
 * light/dark automatically.
 */
const statusFill: Record<StatusDotStatus, string> = {
  ok: 'bg-[var(--rvui-success)]',
  warn: 'bg-[var(--rvui-warning)]',
  error: 'bg-[var(--rvui-error)]',
  idle: 'bg-[var(--rvui-text-2)]',
};

export interface StatusDotProps {
  status: StatusDotStatus;
  /** Emit a soft ping ring. Suppressed when the user requests reduced motion. */
  pulse?: boolean;
  /**
   * Accessible label, REQUIRED. Colour alone is not an accessible status cue
   * (fails WCAG 1.4.1 and is ambiguous for colourblind users), so a bare dot
   * always exposes its meaning to assistive tech as text.
   */
  label: string;
  className?: string;
}

/**
 * A small status indicator: a token-filled dot with an optional pulse ring and
 * a required screen-reader label. Ported from the Studio `StatusDot` and
 * re-authored to the package conventions (semantic `status` variants, the
 * native `useReducedMotion` primitive gating the pulse).
 */
export function StatusDot({
  status,
  pulse = false,
  label,
  className,
}: StatusDotProps): React.JSX.Element {
  const reduce = useReducedMotion();
  const fill = statusFill[status];
  const animate = pulse && !reduce;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-flex size-2.5 shrink-0', className)}
    >
      {animate && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
            fill,
          )}
        />
      )}
      <span aria-hidden="true" className={cn('relative inline-flex size-2.5 rounded-full', fill)} />
    </span>
  );
}
