/**
 * Audit-signer composition from environment (GAP-355 Stage 3, spec D4/D5).
 *
 * The ONE place the fleet turns `REVEALUI_AUDIT_SIGNING_KEY` into a row signer,
 * and `REVEALUI_AUDIT_PUBLIC_KEY` (or the private key) into the published public
 * key. Promoted out of `apps/server/src/lib/audit-signer.ts` (Stage 3 PR-2) so
 * all three audit writers — apps/server (cached, process-wide), the admin setup
 * route, and the CLI bootstrap script — compose the signer identically instead
 * of each re-deriving the key, kid, and canonical byte builder.
 *
 * Deliberately logger-free: `@revealui/security` sits below the fleet loggers in
 * the dependency graph, so this module returns the resolved MODE and each caller
 * logs it in its own idiom. That keeps "unsigned because dev" and "unsigned
 * because misconfigured" from ever being confused (spec D6) without inverting a
 * dependency.
 */

import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { type AuditSignable, auditSignableBytes, Ed25519AuditRowSigner } from './audit-signing.js';

/** Env source: anything mapping variable names to string-or-undefined. */
export type AuditSignerEnv = Record<string, string | undefined>;

/**
 * The store's injected signer shape. Structurally identical to `@revealui/db`'s
 * `AuditRowSignerFn` (the store stays crypto-free and security-package-free), so
 * the composed closure is assignable at the injection site: given the full row
 * incl. its pre-fetched `sequence`, return the `v1.ed25519.<kid>.<sig>` value.
 */
export type AuditRowSignerFn = (row: AuditSignable) => string;

export interface AuditSignerResolution {
  /** The composed row signer, or `undefined` in unsigned mode. */
  readonly signer: AuditRowSignerFn | undefined;
  /**
   * The raw Ed25519 signer for non-row payloads (GAP-355 S4-3 anchor roots).
   * Same instance the row `signer` closes over; signed mode only.
   */
  readonly cryptoSigner: Ed25519AuditRowSigner | undefined;
  /** `signed` when a valid key was present, `unsigned` otherwise. */
  readonly mode: 'signed' | 'unsigned';
  /** The resolved key id (signed mode only). */
  readonly kid?: string;
}

/**
 * Restore real newlines in a single-line PEM. `env_file` transports (RevForge
 * kits write `docker/.env`, and Docker's env_file format is one line per key)
 * deliver PEMs with literal `\n` escapes; real multi-line PEMs pass through
 * untouched. Mirrors the license path's normalizePem (GAP-259 P0-4 precedent:
 * split/join, no authored regex).
 */
function normalizeEnvPem(raw: string): string {
  return raw.includes('\\n') ? raw.split('\\n').join('\n') : raw;
}

/**
 * Derive a stable, key-bound kid: `ed25519-<first 16 hex of sha256(SPKI DER)>`.
 * Computed over the PUBLIC half, so it is identical whether derived from the
 * private key (a signer) or the public key (the endpoint). Deterministic for a
 * given key, changes on rotation, and contains no `.` — safe inside the dotted
 * wire format.
 */
export function deriveAuditKid(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = createHash('sha256').update(der).digest('hex').slice(0, 16);
  return `ed25519-${fingerprint}`;
}

/** Resolve the kid: the `REVEALUI_AUDIT_SIGNING_KID` override, else derived. */
function resolveKid(env: AuditSignerEnv, publicKey: KeyObject): string {
  const override = env.REVEALUI_AUDIT_SIGNING_KID?.trim();
  return override && override.length > 0 ? override : deriveAuditKid(publicKey);
}

/**
 * Compose the audit-row signer from `REVEALUI_AUDIT_SIGNING_KEY`. Constructing
 * the signer validates the key (throws on a non-Ed25519 / malformed PKCS#8 PEM),
 * the same parse the boot guard relies on — a configured-but-broken key fails
 * loud, it never silently degrades to unsigned. An ABSENT key resolves to
 * unsigned mode (legal only in dev/test; a production signing deployment refuses
 * to boot without it, `validate-startup.ts`). No fallback secret: a signing key
 * with a fallback is not a signing key.
 */
export function createAuditRowSignerFromEnv(env: AuditSignerEnv): AuditSignerResolution {
  const rawKey = env.REVEALUI_AUDIT_SIGNING_KEY?.trim();
  if (!rawKey) {
    return { signer: undefined, cryptoSigner: undefined, mode: 'unsigned' };
  }
  const privateKeyPem = normalizeEnvPem(rawKey);
  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  const kid = resolveKid(env, publicKey);
  const cryptoSigner = new Ed25519AuditRowSigner(privateKeyPem, kid);
  return {
    signer: (row) => cryptoSigner.sign(auditSignableBytes(row)).value,
    cryptoSigner,
    mode: 'signed',
    kid,
  };
}

/** The published audit public key (spec D4): what `GET /api/audit/public-key` returns. */
export interface ResolvedAuditPublicKey {
  readonly alg: 'ed25519';
  readonly kid: string;
  /** SPKI PEM, real newlines. */
  readonly publicKeyPem: string;
}

/**
 * Resolve the public key to publish: `REVEALUI_AUDIT_PUBLIC_KEY` (SPKI PEM) if
 * set, else derived from `REVEALUI_AUDIT_SIGNING_KEY`. Returns `null` in unsigned
 * mode (neither key present) so the endpoint answers an honest 404, never a 500.
 * kid precedence matches the signer (`REVEALUI_AUDIT_SIGNING_KID` honored).
 *
 * When BOTH env vars are present they MUST be the same keypair: the explicit
 * public key is cross-checked (SPKI DER byte-equality) against the public half
 * of the private key. A mismatched pair would publish a key that verifies NO
 * row — and with a `REVEALUI_AUDIT_SIGNING_KID` override both would even carry
 * the same kid, so every verification would fail silently. That misconfiguration
 * throws loudly here (naming both env vars, never key material) — the one case
 * where a loud 500 beats an honest key. Also throws on a present-but-malformed
 * key. A misconfiguration must be loud.
 */
export function resolveAuditPublicKey(env: AuditSignerEnv): ResolvedAuditPublicKey | null {
  const rawExplicit = env.REVEALUI_AUDIT_PUBLIC_KEY?.trim();
  const explicit = rawExplicit ? normalizeEnvPem(rawExplicit) : rawExplicit;
  const rawPrivate = env.REVEALUI_AUDIT_SIGNING_KEY?.trim();
  const privateKeyPem = rawPrivate ? normalizeEnvPem(rawPrivate) : rawPrivate;
  let publicKey: KeyObject;
  if (explicit) {
    publicKey = createPublicKey(explicit);
    if (privateKeyPem) {
      const derivedDer = createPublicKey(createPrivateKey(privateKeyPem)).export({
        type: 'spki',
        format: 'der',
      });
      const explicitDer = publicKey.export({ type: 'spki', format: 'der' });
      if (!derivedDer.equals(explicitDer)) {
        throw new Error(
          'REVEALUI_AUDIT_PUBLIC_KEY does not match the public half of ' +
            'REVEALUI_AUDIT_SIGNING_KEY. The published key would verify no audit row. ' +
            'Provision the matching keypair.',
        );
      }
    }
  } else {
    if (!privateKeyPem) return null;
    publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  }
  const kid = resolveKid(env, publicKey);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { alg: 'ed25519', kid, publicKeyPem };
}
