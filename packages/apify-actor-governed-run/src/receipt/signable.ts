import { canonicalizeJcs } from '@revealui/security';
import type { ActionLogEntry, RunContext } from '../types.js';

/** The exact fields a receipt's signature covers. `publicKey` travels with the
 * receipt for verification but is deliberately NOT part of the signed payload
 * -- it identifies the key, it isn't integrity-bearing data.
 *
 * `actorId` / `actorRunId` / `actorBuildId` (the run-context fields) ARE part
 * of the signed payload -- that is the whole point (GAP-431 guardrail-2
 * blocker 1): a receipt's provenance claim must be tamper-evident, not just
 * carried alongside the signature as unsigned metadata. */
export interface ReceiptSignablePayload extends RunContext {
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
    actorId: payload.actorId,
    actorRunId: payload.actorRunId,
    actorBuildId: payload.actorBuildId,
  });
  return new TextEncoder().encode(canonical);
}
