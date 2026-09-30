// Receipt-motif hero content (frontend-excellence Phase 5, receipt-hero-concept
// spec 2026-07-18). A demonstration, not live production data: timestamps are
// static strings (never Date.now()) so the sequence is deterministic for SSR
// and the visual gate. The card renders on the marketing home,
// beside the hero. DocsIndexPage does not mount it.
// See claims-evidence.ts for the evidence trail on every sentence here.
//
// GAP-355 Stage 4 S4-6: the foil remains canonical positioning copy. The
// customer-held Merkle root + offline CLI are Pro+ (auditLog); Free gets
// row signing without root delivery. Verification is never for sale.

import type { AuditEvent } from '@revealui/presentation';

export const RECEIPT_HERO_TITLE = 'Illustrated agent action record' as const;

export const RECEIPT_HERO_LINES: readonly AuditEvent[] = [
  {
    ts: '10:14:02',
    actor: 'ops-agent',
    action: 'signed in as',
    object: 'agents@demo.revealui.com',
  },
  {
    ts: '09:41:09',
    actor: 'policy',
    action: 'allowed',
    object: 'refunds under $100',
  },
  {
    ts: '09:41:10',
    actor: 'support-agent',
    action: 'refunded',
    object: 'order #4189',
  },
  {
    ts: '09:41:11',
    actor: 'audit-log',
    action: 'recorded',
    // `object` stays a human-readable description (not the raw ref) so
    // AuditLine's object text and its CopyRef affordance don't render the
    // same string twice; `refId` carries the copyable id.
    object: 'the receipt',
    refId: 'rcpt_docs01',
  },
] as const;

export const RECEIPT_HERO_INTEGRITY = {
  kind: 'sha256',
  value: 'c3d1…7a90',
} as const;

// Soft foil (GAP-355 S6-6 owner ruling option b, 2026-07-29). Row signatures
// ship when audit signing is configured; Merkle root *delivery* is Pro+
// (auditLog). Verification is never paid. See docs/security/AUDIT_RECEIPTS.md
// and CLAIMS_RECEIPT_HOLD_NOTE.
export const RECEIPT_HERO_CAPTION = {
  text: 'Illustrated action record. Supported actions can be recorded when audit signing is configured.',
  link: {
    label: 'Read the receipt guide →',
    href: 'https://docs.revealui.com/security/AUDIT_RECEIPTS',
  },
} as const;
