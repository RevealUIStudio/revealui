'use client';

import type React from 'react';
import { cn } from '../utils/cn.js';
import { CopyRef } from './_receipt-shared.js';
import { type AuditEvent, AuditLine } from './audit-line.js';

/** Integrity seal for a receipt (e.g. a content hash). */
export interface ReceiptIntegrity {
  /** Algorithm or scheme name, e.g. "sha256". */
  kind: string;
  /** The integrity value, copy-on-click. */
  value: string;
}

export interface ReceiptCardProps {
  title: string;
  /** Ordered audit events, oldest first. Reuses `AuditLine`'s event type. */
  lines: AuditEvent[];
  /** Optional integrity footer sealing the receipt. */
  integrity?: ReceiptIntegrity;
  className?: string;
}

const MONO = 'var(--rvui-font-mono, ui-monospace, monospace)';
const DASHED_BORDER = 'var(--rvui-border, oklch(0.83 0.015 245 / 0.12))';

function SealIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A receipt: a titled header, a stack of `AuditLine` events, and an optional
 * integrity footer. The carrier of the "if an agent did it, there's a receipt"
 * motif — monospace throughout, tabular-nums, perforated dashed dividers.
 */
export function ReceiptCard({
  title,
  lines,
  integrity,
  className,
}: ReceiptCardProps): React.JSX.Element {
  const latest = lines.length > 0 ? lines[lines.length - 1]?.ts : undefined;

  return (
    <section
      aria-label={title}
      className={cn('flex flex-col border', className)}
      style={{
        backgroundColor: 'var(--rvui-surface-1, oklch(0.22 0.025 258))',
        borderColor: DASHED_BORDER,
        borderRadius: 'var(--rvui-radius-lg, 16px)',
      }}
    >
      <header className="flex items-baseline justify-between gap-3 px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--rvui-text-0)]">{title}</h3>
        {latest && (
          <time
            dateTime={latest}
            className="whitespace-nowrap text-xs tabular-nums text-[var(--rvui-text-2)]"
            style={{ fontFamily: MONO }}
          >
            {latest}
          </time>
        )}
      </header>

      {lines.length > 0 && (
        <ul
          className="flex flex-col gap-1 border-t border-dashed px-4 py-3"
          style={{ borderColor: DASHED_BORDER }}
        >
          {lines.map((line, i) => (
            <li key={line.refId ?? `${line.ts}-${line.actor}-${line.action}-${i}`}>
              <AuditLine event={line} dense />
            </li>
          ))}
        </ul>
      )}

      {integrity && (
        <footer
          className="flex items-center gap-2 border-t border-dashed px-4 py-2.5 text-xs"
          style={{ borderColor: DASHED_BORDER }}
        >
          <span aria-hidden="true" className="inline-flex shrink-0 text-[var(--rvui-text-2)]">
            <SealIcon />
          </span>
          <span className="uppercase tracking-wide text-[var(--rvui-text-2)]">
            {integrity.kind}
          </span>
          <CopyRef value={integrity.value} noun="integrity hash" className="text-xs" />
        </footer>
      )}
    </section>
  );
}
