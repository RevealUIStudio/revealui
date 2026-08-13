// Docs landing receipt motif (frontend-excellence Phase 5 rollout echo,
// GAP-480 Phase D). Static only: no animate="print". Demonstration content,
// not live production data. Timestamps are static strings.
// Links to /security/audit-receipts for the real product docs.

import type { AuditEvent } from '@revealui/presentation';

export const DOCS_RECEIPT_TITLE = 'Governed action, on record' as const;

export const DOCS_RECEIPT_LINES: readonly AuditEvent[] = [
  {
    ts: '10:14:02',
    actor: 'ops-agent',
    action: 'signed in as',
    object: 'agents@demo.revealui.com',
  },
  {
    ts: '10:14:05',
    actor: 'ops-agent',
    action: 'ran',
    object: 'policy check on deploy #318',
  },
  {
    ts: '10:14:06',
    actor: 'audit-log',
    action: 'recorded',
    object: 'the receipt',
    refId: 'rcpt_docs01',
  },
] as const;

export const DOCS_RECEIPT_INTEGRITY = {
  kind: 'sha256',
  value: 'c3d1…7a90',
} as const;

export const DOCS_RECEIPT_CAPTION = {
  text: "If an agent did it, there's a receipt.",
  link: { label: 'Audit receipts docs →', href: '/security/audit-receipts' },
} as const;
