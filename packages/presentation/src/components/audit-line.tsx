'use client';

import type React from 'react';
import { cn } from '../utils/cn.js';
import { CopyRef } from './_receipt-shared.js';

/** A single audit event — the atom of the receipt motif. */
export interface AuditEvent {
  /** ISO timestamp string, rendered in tabular-nums. */
  ts: string;
  /** Who or what performed the action. */
  actor: string;
  /** What they did (verb). */
  action: string;
  /** The thing acted on. */
  object: string;
  /** Optional receipt reference; when present it becomes copy-on-click. */
  refId?: string;
}

export interface AuditLineProps {
  event: AuditEvent;
  /** Tighter spacing and smaller type for packed ledgers. */
  dense?: boolean;
  className?: string;
}

const MONO = 'var(--rvui-font-mono, ui-monospace, monospace)';

/**
 * A monospace ledger line: timestamp, actor, action, object, and an optional
 * copy-on-click receipt reference. Tabular-nums keeps timestamps and refs in
 * vertical register across a stack. The receipt motif's atom.
 */
export function AuditLine({ event, dense = false, className }: AuditLineProps): React.JSX.Element {
  const { ts, actor, action, object, refId } = event;

  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline tabular-nums',
        dense ? 'gap-x-2 gap-y-0.5 text-xs' : 'gap-x-3 gap-y-1 text-sm',
        className,
      )}
      style={{ fontFamily: MONO }}
    >
      <time dateTime={ts} className="whitespace-nowrap text-[var(--rvui-text-2)]">
        {ts}
      </time>
      <span className="font-medium text-[var(--rvui-text-0)]">{actor}</span>
      <span className="text-[var(--rvui-text-1)]">{action}</span>
      <span className="text-[var(--rvui-text-0)]">{object}</span>
      {refId && (
        <CopyRef value={refId} noun="reference" className={dense ? 'text-xs' : 'text-sm'} />
      )}
    </div>
  );
}
