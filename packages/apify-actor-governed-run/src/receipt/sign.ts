import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { deriveAuditKid, Ed25519AuditRowSigner } from '@revealui/security/server';
import type { ActionLogEntry, Receipt } from '../types.js';
import { receiptSignableBytes } from './signable.js';

/**
 * Sign a completed run's action log into a self-contained, offline-verifiable
 * receipt.
 *
 * Reuses the fleet's audit-log signing primitives (`@revealui/security`,
 * GAP-355 `2026-07-12-audit-receipt-architecture`): the same Ed25519 signer
 * class, the same `v1.ed25519.<kid>.<sig>` wire format, and the same RFC 8785
 * canonicalization (via `receiptSignableBytes`). It deliberately does NOT
 * reuse the fleet's audit *key management* (`REVEALUI_AUDIT_SIGNING_KEY` /
 * `createAuditRowSignerFromEnv`) -- that key backs RevealUI's own internal
 * audit log and is not meant to sign a customer's Apify run. Instead each run
 * generates its own fresh Ed25519 keypair and embeds the public half directly
 * in the receipt, so a receipt can be verified by anyone with no dependency on
 * RevealUI's servers or secrets -- the actor's entire trust story is "the
 * receipt carries its own key."
 */
export function signActionLog(actionLog: ActionLogEntry[]): Receipt {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const kid = deriveAuditKid(createPublicKey(publicKey));
  const signer = new Ed25519AuditRowSigner(privateKey, kid);
  const timestamp = new Date().toISOString();
  const algorithm = 'ed25519' as const;

  const bytes = receiptSignableBytes({ actionLog, algorithm, timestamp });
  const { value: signature } = signer.sign(bytes);

  return { actionLog, signature, publicKey, algorithm, timestamp };
}
