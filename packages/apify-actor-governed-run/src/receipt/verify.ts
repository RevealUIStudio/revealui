import { createPublicKey } from 'node:crypto';
import { deriveAuditKid, verifyEd25519AuditSignature } from '@revealui/security/server';
import { ReceiptSchema } from '../types.js';
import { receiptSignableBytes } from './signable.js';

export interface VerifyReceiptResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify a Governed Agent Run receipt entirely offline: no network call, no
 * database, no dependency on RevealUI infrastructure. This is the standalone
 * verify function the actor's `verify-receipt` mode wraps, and it is exported
 * from the package so anyone holding a receipt can check it in their own
 * Node process (`import { verifyReceipt } from '@revealui/apify-actor-governed-run'`).
 *
 * Reuses `@revealui/security`'s `verifyEd25519AuditSignature` (the same
 * verifier the fleet's own audit-log signatures use) end to end -- only the
 * "what bytes were signed" builder (`receiptSignableBytes`) is specific to
 * the receipt's own shape, since a receipt is not an `audit_log` row.
 */
export function verifyReceipt(receipt: unknown): VerifyReceiptResult {
  const parsed = ReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    return { valid: false, reason: `malformed receipt: ${parsed.error.message}` };
  }
  const { actionLog, signature, publicKey, algorithm, timestamp } = parsed.data;

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

  const bytes = receiptSignableBytes({ actionLog, algorithm, timestamp });
  const result = verifyEd25519AuditSignature(bytes, signature, () => keyObject);
  if (!result.valid) {
    return { valid: false, reason: result.reason ?? 'signature verification failed' };
  }
  return { valid: true };
}
