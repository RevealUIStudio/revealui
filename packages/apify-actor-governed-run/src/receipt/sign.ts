import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { deriveAuditKid, Ed25519AuditRowSigner } from '@revealui/security/server';
import type { ActionLogEntry, Receipt, RunContext } from '../types.js';
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
 *
 * `runContext` (GAP-431 guardrail-2 blocker 1) binds the receipt to the
 * actual Apify run -- the caller (main.ts) derives it from `Actor.getEnv()`.
 * It is signed, not just attached, so it cannot be swapped after the fact.
 * This is what makes a receipt platform-attributable: a verifier can take
 * `receipt.actorRunId` and check that run's own dataset/KV record on Apify
 * for a matching receipt, something a standalone forger cannot produce.
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
