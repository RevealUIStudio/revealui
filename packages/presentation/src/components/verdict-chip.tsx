import type React from 'react';
import { cn } from '../utils/cn.js';

export type Verdict = 'approve' | 'request-changes' | 'hold' | 'pending';

interface VerdictMeta {
  /** Visible + spoken verdict word. */
  word: string;
  /** Semantic `--rvui-*` token classes for the chip (subtle fill + colour). */
  classes: string;
}

// Text tokens are AA-safe on the matching subtle fills (fill tokens alone
// fail small-text contrast — see Button solid/outline warning path).
const verdictMeta: Record<Verdict, VerdictMeta> = {
  approve: {
    word: 'Approved',
    classes: 'bg-[var(--rvui-success-subtle)] text-[var(--rvui-success-text)]',
  },
  'request-changes': {
    word: 'Changes requested',
    classes: 'bg-[var(--rvui-error-subtle)] text-[var(--rvui-error-text)]',
  },
  hold: {
    word: 'On hold',
    classes: 'bg-[var(--rvui-warning-subtle)] text-[var(--rvui-warning-text)]',
  },
  pending: {
    word: 'Pending',
    classes: 'bg-[var(--rvui-surface-2)] text-[var(--rvui-text-1)]',
  },
};

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const verdictGlyph: Record<Verdict, React.ReactNode> = {
  approve: <path d="M3.5 8.5l3 3 6-7" {...stroke} />,
  'request-changes': <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...stroke} />,
  hold: <path d="M6 4v8M10 4v8" {...stroke} />,
  pending: (
    <>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth={1.4} />
      <path d="M8 5v3l2 1.5" {...stroke} />
    </>
  ),
};

function VerdictIcon({ verdict }: { verdict: Verdict }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {verdictGlyph[verdict]}
    </svg>
  );
}

export interface VerdictChipProps {
  verdict: Verdict;
  /** Who issued the verdict; shown after the word and folded into the label. */
  actor?: string;
  /** When the verdict was issued; folded into the accessible label. */
  asOf?: string;
  className?: string;
}

/**
 * A guardrail verdict rendered as a compact chip: a semantic icon, the verdict
 * word, and an optional actor. Colour is never the only cue — the verdict word
 * is always present, and the chip carries a composed accessible label so a
 * screen reader announces the verdict, actor, and time as one phrase.
 */
export function VerdictChip({
  verdict,
  actor,
  asOf,
  className,
}: VerdictChipProps): React.JSX.Element {
  const meta = verdictMeta[verdict];
  const label = [meta.word, actor ? `by ${actor}` : null, asOf ? `as of ${asOf}` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium',
        meta.classes,
        className,
      )}
      style={{ borderRadius: 'var(--rvui-radius-full, 9999px)' }}
    >
      <span aria-hidden="true" className="inline-flex shrink-0">
        <VerdictIcon verdict={verdict} />
      </span>
      <span aria-hidden="true">{meta.word}</span>
      {actor && (
        // Full-opacity secondary label (not opacity-70): success/error chip
        // surfaces fail WCAG AA when the actor string is alpha-faded (axe
        // color-contrast ~2.9 on approve). Actor stays in aria-label above.
        <span aria-hidden="true" className="font-normal">
          · {actor}
        </span>
      )}
    </span>
  );
}
