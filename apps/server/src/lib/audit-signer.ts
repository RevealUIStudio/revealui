/**
 * Audit-row signer construction site (GAP-355 Stage 3, spec D5).
 *
 * `@revealui/db`'s `DrizzleAuditStore` stays crypto-free and takes an injected
 * `AuditRowSignerFn`. This module is where `apps/server` composes the real thing:
 * an `Ed25519AuditRowSigner` + the RFC 8785 `auditSignableBytes` builder from
 * `@revealui/security`, wrapped in a closure that matches the store's structural
 * signer type. `createAuditStore(db)` is the ONE helper every apps/server audit
 * writer uses, so no writer can accidentally construct an unsigned store on a
 * signing deployment.
 *
 * Modes (spec D6):
 *  - `REVEALUI_AUDIT_SIGNING_KEY` set (valid Ed25519 PKCS#8 PEM) → SIGNING. Every
 *    row carries a `v1.ed25519.<kid>.<sig>` signature verifiable offline from the
 *    published public key.
 *  - Unset → UNSIGNED. Legal ONLY in dev/test; a production signing deployment
 *    refuses to boot without the key (`validate-startup.ts`). The mode is logged
 *    at boot so "unsigned because dev" and "unsigned because misconfigured" can
 *    never be confused.
 *
 * The signing key never has a fallback — a signing key with a fallback is not a
 * signing key. The legacy `REVEALUI_AUDIT_HMAC_SECRET` / `REVEALUI_SECRET`
 * fallback died with the HMAC path.
 */

import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { auditSignableBytes, Ed25519AuditRowSigner } from '@revealui/core/security';
import { type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';

/**
 * Derive a stable, key-bound `kid` when `REVEALUI_AUDIT_SIGNING_KID` is not set:
 * `ed25519-<first 16 hex of sha256(SPKI DER)>`. Deterministic for a given key
 * (so verification resolves it consistently) and it changes when the key
 * rotates. Contains no `.`, so it is safe inside the dotted wire format.
 */
function deriveKid(privateKeyPem: string): string {
  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = createHash('sha256').update(der).digest('hex').slice(0, 16);
  return `ed25519-${fingerprint}`;
}

/**
 * Build the signer from env, or `undefined` in unsigned mode. Constructing the
 * `Ed25519AuditRowSigner` validates the key (throws on a non-Ed25519 or malformed
 * PKCS#8 key) — the same parse the boot guard relies on. Logs the resolved mode.
 */
function buildAuditRowSigner(env: NodeJS.ProcessEnv): AuditRowSignerFn | undefined {
  const privateKeyPem = env.REVEALUI_AUDIT_SIGNING_KEY?.trim();
  if (!privateKeyPem) {
    logger.warn(
      'AUDIT SIGNING: DISABLED — audit rows will be written UNSIGNED (no ' +
        'REVEALUI_AUDIT_SIGNING_KEY). Legal only in dev/test; a production signing ' +
        'deployment refuses to boot without the key.',
    );
    return undefined;
  }

  const kid = env.REVEALUI_AUDIT_SIGNING_KID?.trim() || deriveKid(privateKeyPem);
  const signer = new Ed25519AuditRowSigner(privateKeyPem, kid);
  logger.info(`AUDIT SIGNING: ENABLED (alg=ed25519, kid=${kid})`);
  return (row) => signer.sign(auditSignableBytes(row)).value;
}

let cachedSigner: AuditRowSignerFn | undefined;
let resolved = false;

/**
 * The process-wide audit-row signer (built once from `process.env`), or
 * `undefined` in unsigned mode. Cached so the mode is resolved and logged
 * exactly once per process.
 */
export function getAuditRowSigner(): AuditRowSignerFn | undefined {
  if (!resolved) {
    cachedSigner = buildAuditRowSigner(process.env);
    resolved = true;
  }
  return cachedSigner;
}

/**
 * Construct a `DrizzleAuditStore` wired to the process-wide signer. Every
 * apps/server audit writer builds its store through this helper so a row written
 * through the one door on a signing deployment always carries a signature.
 */
export function createAuditStore(db: Database): DrizzleAuditStore {
  return new DrizzleAuditStore(db, getAuditRowSigner());
}

/** Test-only reset of the cached signer (re-reads env on next `getAuditRowSigner`). */
export function __resetAuditSignerForTest(): void {
  cachedSigner = undefined;
  resolved = false;
}
