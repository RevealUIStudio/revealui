/**
 * Audit-row signer construction site for apps/server (GAP-355 Stage 3, spec D5).
 *
 * `@revealui/db`'s `DrizzleAuditStore` stays crypto-free and takes an injected
 * `AuditRowSignerFn`. The real composition — turning `REVEALUI_AUDIT_SIGNING_KEY`
 * into an `Ed25519AuditRowSigner` over the RFC 8785 `auditSignableBytes` builder,
 * deriving the kid — lives in `@revealui/security`'s `createAuditRowSignerFromEnv`
 * (ONE implementation, shared with the admin setup route and the CLI bootstrap
 * script). This module only adds the apps/server concerns: a process-wide cache
 * so the mode is resolved and logged exactly once, and the `createAuditStore`
 * wrapper every apps/server audit writer uses so none can accidentally construct
 * an unsigned store on a signing deployment.
 *
 * Modes (spec D6): key present → SIGNING (every row carries a
 * `v1.ed25519.<kid>.<sig>` signature verifiable offline from the published
 * public key); absent → UNSIGNED (legal ONLY in dev/test; a production signing
 * deployment refuses to boot without the key, `validate-startup.ts`). The mode
 * is logged at boot so "unsigned because dev" and "unsigned because
 * misconfigured" can never be confused.
 */

import { logger } from '@revealui/core/observability/logger';
import { createAuditRowSignerFromEnv } from '@revealui/core/security';
import { type AuditRowSignerFn, DrizzleAuditStore } from '@revealui/db';
import type { Database } from '@revealui/db/client';

let cachedSigner: AuditRowSignerFn | undefined;
let resolved = false;

/**
 * The process-wide audit-row signer (composed once from `process.env`), or
 * `undefined` in unsigned mode. Cached so the mode is resolved and logged
 * exactly once per process.
 */
export function getAuditRowSigner(): AuditRowSignerFn | undefined {
  if (!resolved) {
    const { signer, mode, kid } = createAuditRowSignerFromEnv(process.env);
    if (mode === 'signed') {
      logger.info(`AUDIT SIGNING: ENABLED (alg=ed25519, kid=${kid})`);
    } else {
      logger.warn(
        'AUDIT SIGNING: DISABLED — audit rows will be written UNSIGNED (no ' +
          'REVEALUI_AUDIT_SIGNING_KEY). Legal only in dev/test; a production signing ' +
          'deployment refuses to boot without the key.',
      );
    }
    cachedSigner = signer;
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
