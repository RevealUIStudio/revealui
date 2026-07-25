/**
 * Thin re-export — the audit-row signer composition moved to
 * `@revealui/auth/server` (GAP-338) alongside the storage boundary, so the
 * admin process signs at its door with the SAME env-derived Ed25519 signer.
 * This shim keeps every existing apps/server import path working.
 */

export {
  __resetAuditSignerForTest,
  createAuditStore,
  getAuditRowSigner,
} from '@revealui/auth/server';
