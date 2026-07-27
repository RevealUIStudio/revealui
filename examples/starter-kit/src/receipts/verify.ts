import { createPublicKey } from 'node:crypto';
import { deriveAuditKid, verifyEd25519AuditSignature } from '@revealui/security/server';
import { receiptSignableBytes } from './signable.js';
import { ReceiptSchema } from './types.js';

export interface VerifyReceiptResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify a receipt entirely offline: no network call, no database, no
 * dependency on RevealUI infrastructure — the whole point of shipping the
 * public key inside the receipt itself. Anyone holding a `receipt.json` can
 * run this in their own Node process; it's what `verify-receipt-cli.ts`
 * wraps for the command line.
 *
 * This proves the receipt's bytes were not altered after signing. It does
 * NOT prove which machine produced the run, or that a specific LLM call
 * actually happened — say that honestly in any buyer-facing copy. If you
 * need platform-attributable provenance too, see the GAP-431 pattern
 * (`packages/apify-actor-governed-run`), which binds a receipt to a
 * third-party run record it cannot forge.
 */
export function verifyReceipt(receipt: unknown): VerifyReceiptResult {
  const parsed = ReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    return { valid: false, reason: `malformed receipt: ${parsed.error.message}` };
  }
  const { actionLog, signature, publicKey, algorithm, timestamp, runnerId, runId } = parsed.data;

  let keyObject: ReturnType<typeof createPublicKey>;
  try {
    keyObject = createPublicKey(publicKey);
  } catch {
    return { valid: false, reason: 'embedded public key could not be parsed' };
  }
  if (keyObject.asymmetricKeyType !== 'ed25519') {
    return {
      valid: false,
      reason: `embedded public key is not ed25519 (got ${keyObject.asymmetricKeyType ?? 'unknown'})`,
    };
  }

  const sigParts = signature.split('.');
  if (sigParts.length !== 4) {
    return { valid: false, reason: 'malformed signature: expected v1.ed25519.<kid>.<sig>' };
  }
  const kidInSignature = sigParts[2];
  const expectedKid = deriveAuditKid(keyObject);
  if (kidInSignature !== expectedKid) {
    return { valid: false, reason: 'signature key id does not match the embedded public key' };
  }

  const bytes = receiptSignableBytes({ actionLog, algorithm, timestamp, runnerId, runId });
  const result = verifyEd25519AuditSignature(bytes, signature, () => keyObject);
  if (!result.valid) {
    return { valid: false, reason: result.reason ?? 'signature verification failed' };
  }
  return { valid: true };
}
