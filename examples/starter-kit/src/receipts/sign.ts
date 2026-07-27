import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { deriveAuditKid, Ed25519AuditRowSigner } from '@revealui/security/server';
import { receiptSignableBytes } from './signable.js';
import type { ActionLogEntry, Receipt, RunContext } from './types.js';

/**
 * Sign a completed run's action log into a self-contained, offline-verifiable
 * receipt.
 *
 * Reuses the fleet's own audit-log signing primitives (`@revealui/security`,
 * GAP-355 `2026-07-12-audit-receipt-architecture`) — the same Ed25519 signer
 * class, the same `v1.ed25519.<kid>.<sig>` wire format, and the same RFC 8785
 * canonicalization (via `receiptSignableBytes`) that RevealUI's own audit log
 * and the GAP-431 Apify actor use. It deliberately does NOT reuse the
 * fleet's audit *key management* — that key backs RevealUI's own internal
 * audit log, not a recipe you run on your own machine. Instead every run
 * generates its own fresh Ed25519 keypair and embeds the public half
 * directly in the receipt, so a receipt can be verified by anyone with no
 * dependency on RevealUI's servers or secrets: the receipt carries its own
 * key.
 */
export function signActionLog(actionLog: ActionLogEntry[], runContext: RunContext): Receipt {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const kid = deriveAuditKid(createPublicKey(publicKey));
  const signer = new Ed25519AuditRowSigner(privateKey, kid);
  const timestamp = new Date().toISOString();
  const algorithm = 'ed25519' as const;

  const bytes = receiptSignableBytes({ actionLog, algorithm, timestamp, ...runContext });
  const { value: signature } = signer.sign(bytes);

  return { actionLog, signature, publicKey, algorithm, timestamp, ...runContext };
}
