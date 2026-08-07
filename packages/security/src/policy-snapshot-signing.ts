/**
 * Ed25519 sign/verify for GAP-381 policy snapshots (design I-5).
 *
 * Reuses the Stage-3 audit wire format and JCS canonicalization so one
 * verifier mental model covers audit rows and policy documents:
 *
 *   v1.ed25519.<kid>.<base64url(signature)>
 *
 * Signed fields: `version`, `issuedAt`, `rules` only. `keyId` and
 * `signature` are never inside the signed payload (they describe the
 * signature). A missing or invalid signature must never produce an
 * "enforced" claim (load path returns invalid / cryptoVerified:false).
 */

import { createPublicKey, type KeyObject } from 'node:crypto';
import {
  type AuditRowSigner,
  Ed25519AuditRowSigner,
  type Ed25519VerifyResult,
  type PublicKeyResolver,
  verifyEd25519AuditSignature,
} from './audit-signing.js';
import { canonicalizeJcs } from './jcs.js';

/** Integrity-bearing body of a policy snapshot (excludes signature fields). */
export interface PolicySnapshotSignable {
  readonly version: number;
  readonly issuedAt: string;
  readonly rules: readonly unknown[];
}

/** Full snapshot document as served / cached on disk. */
export interface PolicySnapshotDocument extends PolicySnapshotSignable {
  readonly keyId: string;
  readonly signature: string;
}

/** Structure-only placeholder values (server unsigned mode). */
export const UNSIGNED_POLICY_KEY_ID = 'unsigned-structure-only';
export const UNSIGNED_POLICY_SIGNATURE = 'unsigned';

/**
 * Canonical bytes signed for a policy snapshot. Field order is fixed by JCS;
 * only these three fields are integrity-bearing.
 */
export function policySnapshotSignableBytes(body: PolicySnapshotSignable): Uint8Array {
  const canonical = canonicalizeJcs({
    version: body.version,
    issuedAt: body.issuedAt,
    rules: body.rules,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Sign a policy snapshot body. Returns the wire `keyId` + `signature` to
 * attach to the document (never re-embeds them into the signed payload).
 */
export function signPolicySnapshot(
  body: PolicySnapshotSignable,
  signer: AuditRowSigner,
): { readonly keyId: string; readonly signature: string } {
  const { value } = signer.sign(policySnapshotSignableBytes(body));
  return { keyId: signer.kid, signature: value };
}

/**
 * Verify a policy snapshot signature. Structure-only / placeholder values
 * (`unsigned`) return `{ valid: false }` without throwing.
 */
export function verifyPolicySnapshot(
  document: PolicySnapshotDocument,
  resolvePublicKey: PublicKeyResolver,
): Ed25519VerifyResult {
  if (
    document.signature === UNSIGNED_POLICY_SIGNATURE ||
    document.keyId === UNSIGNED_POLICY_KEY_ID
  ) {
    return { valid: false, reason: 'unsigned structure-only snapshot' };
  }
  return verifyEd25519AuditSignature(
    policySnapshotSignableBytes({
      version: document.version,
      issuedAt: document.issuedAt,
      rules: document.rules,
    }),
    document.signature,
    resolvePublicKey,
  );
}

/**
 * Build an Ed25519 signer for policy snapshots from a PKCS#8 PEM + kid.
 * Same constructor rules as audit row signing (non-empty kid, no `.`).
 */
export function createPolicySnapshotSigner(
  privateKeyPem: string,
  kid: string,
): Ed25519AuditRowSigner {
  return new Ed25519AuditRowSigner(privateKeyPem, kid);
}

/** Parse a public key PEM for kid-keyed resolvers. */
export function policyPublicKeyFromPem(publicKeyPem: string): KeyObject {
  return createPublicKey(publicKeyPem);
}
