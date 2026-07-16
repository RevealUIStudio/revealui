'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn.js';

const COPIED_RESET_MS = 1500;

const TRANSITION =
  'color var(--rvui-duration-fast, 120ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1))';

function CopyIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CopyRefProps {
  /** The reference string copied to the clipboard verbatim. */
  value: string;
  /** Human noun for the value, spoken in the affordance's label (e.g. "reference"). */
  noun: string;
  className?: string;
}

/**
 * Copy-to-clipboard affordance for a receipt reference string. Renders the
 * value in tabular-nums monospace beside a copy glyph; clicking writes the
 * value to the clipboard, swaps the glyph to a check, and announces the copy
 * through a visually-hidden live region so the outcome is perceivable without
 * relying on the icon change alone.
 */
export function CopyRef({ value, noun, className }: CopyRefProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [value]);

  return (
    <span className={cn('inline-flex items-center', className)}>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`${copied ? 'Copied' : 'Copy'} ${noun} ${value}`}
        className="inline-flex items-center gap-1 rounded-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          fontFamily: 'var(--rvui-font-mono, ui-monospace, monospace)',
          color: copied
            ? 'var(--rvui-success, oklch(0.55 0.130 165))'
            : 'var(--rvui-text-1, oklch(0.83 0.015 245))',
          outlineColor: 'var(--rvui-brand, oklch(0.62 0.19 264))',
          transition: TRANSITION,
        }}
      >
        <span aria-hidden="true">{value}</span>
        <span aria-hidden="true" className="shrink-0">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `Copied ${noun}` : ''}
      </span>
    </span>
  );
}
