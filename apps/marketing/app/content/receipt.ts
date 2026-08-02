// Receipt-motif hero content (frontend-excellence Phase 5, receipt-hero-concept
// spec 2026-07-18). A demonstration, not live production data: timestamps are
// static strings (never Date.now()) so the sequence is deterministic for SSR
// and the visual gate. Content depicts something the product does today.
// See claims-evidence.ts for the evidence trail on every sentence here.
//
// GAP-355 Stage 4 S4-6: the foil remains canonical positioning copy. The
// customer-held Merkle root + offline CLI are Max+ (auditLog); Free/Pro get
// row signing without root delivery. Verification is never for sale.

import type { AuditEvent } from '@revealui/presentation';

export const RECEIPT_HERO_TITLE = 'Refund, handled by an agent' as const;

export const RECEIPT_HERO_LINES: readonly AuditEvent[] = [
  {
    ts: '09:41:07',
    actor: 'support-agent',
    action: 'signed in as',
    object: 'agents@demo.revealui.com',
  },
  {
    ts: '09:41:09',
    actor: 'support-agent',
    action: 'refunded',
    object: 'order #4189',
  },
  {
    ts: '09:41:09',
    actor: 'policy',
    action: 'allowed',
    object: 'refunds under $100',
  },
  {
    ts: '09:41:10',
    actor: 'audit-log',
    action: 'recorded',
    // `object` stays a human-readable description (not the raw ref) so
    // AuditLine's object text and its CopyRef affordance don't render the
    // same string twice; `refId` carries the copyable id from the spec draft.
    object: 'the receipt',
    refId: 'rcpt_8f3ka91',
  },
] as const;

export const RECEIPT_HERO_INTEGRITY = {
  kind: 'sha256',
  value: '4b6c…e91a',
} as const;

// Interim-safe caption (truth-source §7 / GAP-354): the hero motif is a
// demonstration of the product shape, not a claim that prod ships sealed
// agent receipts for every tier today. Re-arm the locked foil
// "If an agent did it, there's a receipt." only after GAP-355 production-path
// proof is registered in claims-evidence.
export const RECEIPT_HERO_CAPTION = {
  text: 'Agents act through your runtime, not a separate black box.',
  link: { label: 'See the claims ledger →', href: '/claims' },
} as const;
