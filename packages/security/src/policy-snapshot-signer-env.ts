/**
 * Compose a policy-snapshot signer + public-key resolver from env (GAP-381 I-5).
 *
 * Preferred keys:
 *   REVEALUI_POLICY_SIGNING_KEY / REVEALUI_POLICY_PUBLIC_KEY / REVEALUI_POLICY_SIGNING_KID
 *
 * Fallback (dogfood / single key fleet): audit Stage-3 keys
 *   REVEALUI_AUDIT_SIGNING_KEY / REVEALUI_AUDIT_PUBLIC_KEY / REVEALUI_AUDIT_SIGNING_KID
 *
 * Fallback is intentional: policy signing must not invent a second secret
 * store before operators can mint a dedicated keypair. Prefer dedicated
 * policy keys in production so audit and policy rotate independently.
 */

import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { deriveAuditKid, normalizeEnvPem } from './audit-signer-env.js';
import type { Ed25519AuditRowSigner } from './audit-signing.js';
import { createPolicySnapshotSigner } from './policy-snapshot-signing.js';

export type PolicySignerEnv = Record<string, string | undefined>;

export interface PolicySnapshotSignerResolution {
  /** Crypto signer, or undefined when no key is configured (unsigned mode). */
  readonly cryptoSigner: Ed25519AuditRowSigner | undefined;
  readonly mode: 'signed' | 'unsigned';
  readonly kid?: string;
  /**
   * Resolve kid → public key for verify paths. Always defined; returns null
   * when the kid is unknown or unsigned mode has no published key.
   */
  readonly resolvePublicKey: (kid: string) => string | KeyObject | null;
}

function readPrivatePem(env: PolicySignerEnv): string | undefined {
  const policy = env.REVEALUI_POLICY_SIGNING_KEY?.trim();
  if (policy && policy.length > 0) return normalizeEnvPem(policy);
  const audit = env.REVEALUI_AUDIT_SIGNING_KEY?.trim();
  if (audit && audit.length > 0) return normalizeEnvPem(audit);
  return undefined;
}

function readPublicPem(env: PolicySignerEnv, privatePem: string | undefined): string | undefined {
  const policy = env.REVEALUI_POLICY_PUBLIC_KEY?.trim();
  if (policy && policy.length > 0) return normalizeEnvPem(policy);
  const audit = env.REVEALUI_AUDIT_PUBLIC_KEY?.trim();
  if (audit && audit.length > 0) return normalizeEnvPem(audit);
  if (privatePem) {
    // Derive SPKI public from private so signed mode always has a verifier.
    const priv = createPrivateKey(privatePem);
    return createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString();
  }
  return undefined;
}

function resolveKid(env: PolicySignerEnv, publicKey: KeyObject): string {
  const override =
    env.REVEALUI_POLICY_SIGNING_KID?.trim() || env.REVEALUI_AUDIT_SIGNING_KID?.trim();
  return override && override.length > 0 ? override : deriveAuditKid(publicKey);
}

/**
 * Compose policy snapshot signer + public resolver from env.
 * A present-but-broken private key throws (fail loud), same as audit compose.
 */
export function createPolicySnapshotSignerFromEnv(
  env: PolicySignerEnv = process.env,
): PolicySnapshotSignerResolution {
  const privatePem = readPrivatePem(env);
  if (!privatePem) {
    return {
      cryptoSigner: undefined,
      mode: 'unsigned',
      resolvePublicKey: () => null,
    };
  }

  const publicPem = readPublicPem(env, privatePem);
  if (!publicPem) {
    throw new Error(
      'createPolicySnapshotSignerFromEnv: private key present but public key could not be resolved',
    );
  }
  const publicKey = createPublicKey(publicPem);
  const kid = resolveKid(env, publicKey);
  const cryptoSigner = createPolicySnapshotSigner(privatePem, kid);

  return {
    cryptoSigner,
    mode: 'signed',
    kid,
    resolvePublicKey: (requestedKid: string) => (requestedKid === kid ? publicPem : null),
  };
}
