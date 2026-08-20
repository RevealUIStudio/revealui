'use client';

import { type AuditEvent, ReceiptCard } from '@revealui/presentation';

export const FIRST_24H_UX_RECEIPT_CARD_TITLE = 'First-24h Pro/Max UX — 2026-08-20';

export interface First24hUxReceiptCardProps {
  lines: AuditEvent[];
}

/**
 * Operator view of first-24h verification receipts. Uses presentation
 * `ReceiptCard` only — no homemade receipt UI and no Merkle-root seal.
 * Checking a receipt is free; this work does not deliver Max `auditLog` roots.
 */
export function First24hUxReceiptCard({ lines }: First24hUxReceiptCardProps): React.JSX.Element {
  return <ReceiptCard title={FIRST_24H_UX_RECEIPT_CARD_TITLE} lines={lines} />;
}
