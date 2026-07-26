import { canonicalizeJcs } from '@revealui/security';
import type { ActionLogEntry } from '../types.js';

/** The exact fields a receipt's signature covers. `publicKey` travels with the
 * receipt for verification but is deliberately NOT part of the signed payload
 * -- it identifies the key, it isn't integrity-bearing data. */
export interface ReceiptSignablePayload {
  actionLog: ActionLogEntry[];
  algorithm: 'ed25519';
  timestamp: string;
}

/**
 * Build the canonical bytes signed for a receipt. Shared by sign and verify
 * (mirrors `@revealui/security`'s `auditSignableBytes` pattern) so a signed
 * payload always re-canonicalizes identically at verify time. Uses RFC 8785
 * JSON Canonicalization (via `canonicalizeJcs`) rather than `JSON.stringify`
 * because plain `JSON.stringify` does not guarantee stable key ordering
 * across engines/round-trips -- the same reason the fleet's audit-log
 * signing uses it (packages/security/src/jcs.ts).
 */
export function receiptSignableBytes(payload: ReceiptSignablePayload): Uint8Array {
  const canonical = canonicalizeJcs({
    actionLog: payload.actionLog,
    algorithm: payload.algorithm,
    timestamp: payload.timestamp,
  });
  return new TextEncoder().encode(canonical);
}
