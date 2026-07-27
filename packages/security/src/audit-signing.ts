/**
 * Per-row Ed25519 signing + verification for the `audit_log` (GAP-355 Stage 3).
 *
 * ADR `2026-07-12-audit-receipt-architecture`: rows are signed independently with
 * an Ed25519 private key; the public key is published so a customer can verify a
 * receipt OFFLINE without our secret. Symmetric HMAC cannot support that (a
 * verifier who can check can also forge), which is why Stage 3 replaces it.
 *
 * This module is the LIBRARY only — the pure canonicalizer + signer + verifier +
 * the shared "what bytes get signed" builder. It wires into no caller here:
 * Stage 3 PR-2 injects the signer at the single `DrizzleAuditStore` door (the
 * ONE DOOR from Stage 2) and retires the legacy HMAC. Keeping this crypto in
 * `@revealui/security/server` (node:crypto) preserves the store's crypto-free
 * dependency direction.
 *
 * Signature wire format (in the existing `signature` text column):
 *
 *   v1.ed25519.<kid>.<base64url(signature)>
 *
 * Legacy discrimination is trivial and total: a NULL column is unsigned; a
 * bare-hex value (no `.`) is a legacy MCP HMAC chain row; `v1.ed25519.*` is a
 * Stage-3 signature. An unknown version/alg verifies as invalid, never as an
 * assumed HMAC.
 */

import { createPrivateKey, createPublicKey, type KeyObject, sign, verify } from 'node:crypto';
import { canonicalizeJcs } from './jcs.js';

// ── What gets signed (ADR §3 / spec D2) ──────────────────────────────

/**
 * The integrity-bearing columns of an `audit_log` row, excluding the signature
 * fields themselves. Every field is signed; any unsigned column would be a
 * freely-editable column, which contradicts the claim the signature backs.
 */
export interface AuditSignable {
  id: string;
  sequence: number;
  tenant: string | null;
  timestamp: Date | string;
  eventType: string;
  severity: string;
  agentId: string;
  taskId: string | null;
  sessionId: string | null;
  payload: unknown;
  policyViolations: string[];
}

/**
 * Render a timestamp to the exact ISO-8601 UTC string (millisecond precision)
 * that is signed. The verifier derives the SAME string from the `timestamptz`
 * readback, so a row round-tripped through the DB re-canonicalizes identically.
 * Timestamp re-serialization is the second most likely verify bug after key
 * order, so it lives in one shared helper used by sign AND verify.
 */
export function auditTimestampString(ts: Date | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) {
    throw new Error('auditTimestampString: invalid timestamp');
  }
  return d.toISOString();
}

/**
 * Normalize the `payload` to the EXACT shape Postgres jsonb stores it as, before
 * signing. The `payload` column is `jsonb`, and the driver writes it as
 * `JSON.stringify(payload)` — which DROPS object keys whose value is `undefined`
 * and turns `undefined` array elements into `null` (ES JSON semantics). So a
 * payload signed with an `undefined` field nested inside it would produce bytes
 * the verifier could NEVER reproduce from the DB readback (where that field is
 * gone) — the signature would be permanently un-verifiable. Worse, the strict
 * `canonicalizeJcs` (which throws on `undefined`, by design, to catch signer
 * bugs on the STRUCTURAL columns) turns that latent verify-mismatch into a hard
 * write failure (GAP-442: prod audit writes fell over on `data.read` events
 * whose payload carried an undefined `actor.ip` / `userAgent` / `requestId`
 * from a header-less health probe).
 *
 * A JSON round-trip is exactly the jsonb storage form, so signing over it makes
 * sign-time bytes equal verify-time (DB) bytes. This does NOT relax the strict
 * check on the structural columns (id/sequence/eventType/severity/agentId) —
 * those still throw on `undefined`, because a signed row genuinely must have
 * them. A clean payload (no undefined) round-trips to an equivalent object and
 * `canonicalizeJcs` re-sorts keys either way, so existing signatures are
 * unchanged; only payloads that previously THREW change (now they sign the
 * stored form).
 */
function toJsonbStorageForm(payload: unknown): unknown {
  if (payload === null || payload === undefined) return null;
  const serialized = JSON.stringify(payload);
  // JSON.stringify returns undefined for a top-level value JSON cannot represent
  // (a bare function/symbol/undefined); jsonb would reject such a write, but the
  // safe, storage-faithful fallback here is null.
  return serialized === undefined ? null : JSON.parse(serialized);
}

/** Build the canonical byte string signed for a row (shared by sign + verify). */
export function auditSignableBytes(row: AuditSignable): Uint8Array {
  const canonical = canonicalizeJcs({
    id: row.id,
    sequence: row.sequence,
    tenant: row.tenant ?? null,
    timestamp: auditTimestampString(row.timestamp),
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId ?? null,
    sessionId: row.sessionId ?? null,
    payload: toJsonbStorageForm(row.payload),
    policyViolations: row.policyViolations ?? [],
  });
  return new TextEncoder().encode(canonical);
}

// ── Signer (spec D5) ─────────────────────────────────────────────────

/**
 * The store's injection point. `sign` is synchronous — `crypto.sign` for
 * Ed25519 is microseconds, so there is no async hop on the write path.
 */
export interface AuditRowSigner {
  /** Sign canonical bytes, returning the `v1.ed25519.<kid>.<sig>` column value. */
  sign(canonicalBytes: Uint8Array): { value: string };
  /** The key id embedded in every signature this signer produces. */
  readonly kid: string;
}

const SIG_VERSION = 'v1';
const SIG_ALG = 'ed25519';

function assertKidSafe(kid: string): void {
  // `.` is the wire-format delimiter; a kid containing one would make the
  // 4-part split ambiguous. Reject rather than silently corrupt.
  if (kid.length === 0 || kid.includes('.')) {
    throw new Error('Ed25519AuditRowSigner: kid must be non-empty and contain no "."');
  }
}

export class Ed25519AuditRowSigner implements AuditRowSigner {
  private readonly key: KeyObject;
  readonly kid: string;

  /**
   * @param privateKeyPem Ed25519 private key, PKCS#8 PEM (GAP-261 convention).
   * @param kid           Self-asserted key id, embedded in each signature.
   */
  constructor(privateKeyPem: string, kid: string) {
    assertKidSafe(kid);
    this.key = createPrivateKey(privateKeyPem);
    if (this.key.asymmetricKeyType !== 'ed25519') {
      throw new Error(
        `Ed25519AuditRowSigner: expected an ed25519 key, got ${this.key.asymmetricKeyType ?? 'unknown'}`,
      );
    }
    this.kid = kid;
  }

  sign(canonicalBytes: Uint8Array): { value: string } {
    const signature = sign(null, Buffer.from(canonicalBytes), this.key);
    return { value: `${SIG_VERSION}.${SIG_ALG}.${this.kid}.${signature.toString('base64url')}` };
  }
}

// ── Verifier (spec D8) ───────────────────────────────────────────────

/** Coarse classification of a stored `signature` column value. */
export type AuditSignatureKind = 'unsigned' | 'legacy-hmac' | 'ed25519' | 'unknown';

/** Classify a `signature` column value without verifying it. */
export function classifyAuditSignature(signature: string | null | undefined): AuditSignatureKind {
  if (signature === null || signature === undefined) return 'unsigned';
  if (signature.startsWith(`${SIG_VERSION}.${SIG_ALG}.`)) return 'ed25519';
  // A bare hex HMAC (legacy MCP chain rows) contains no `.`.
  if (!signature.includes('.')) return 'legacy-hmac';
  return 'unknown';
}

export interface Ed25519VerifyResult {
  valid: boolean;
  kid?: string;
  reason?: string;
}

/** Resolve a `kid` to its Ed25519 public key (SPKI PEM or a KeyObject). */
export type PublicKeyResolver = (kid: string) => string | KeyObject | null | undefined;

/**
 * Verify a `v1.ed25519.*` signature against the canonical bytes. Returns
 * `{ valid: false, reason }` (never throws) on a malformed value or an
 * unresolvable kid, so a caller iterating rows gets a verdict per row.
 */
export function verifyEd25519AuditSignature(
  canonicalBytes: Uint8Array,
  signatureValue: string,
  resolvePublicKey: PublicKeyResolver,
): Ed25519VerifyResult {
  const parts = signatureValue.split('.');
  if (parts.length !== 4 || parts[0] !== SIG_VERSION || parts[1] !== SIG_ALG) {
    return { valid: false, reason: 'unrecognized signature format' };
  }
  const [, , kid, encoded] = parts;
  if (!(kid && encoded)) {
    return { valid: false, kid, reason: 'malformed signature: empty kid or body' };
  }
  const resolved = resolvePublicKey(kid);
  if (!resolved) {
    return { valid: false, kid, reason: `no public key registered for kid "${kid}"` };
  }
  let key: KeyObject;
  try {
    key = typeof resolved === 'string' ? createPublicKey(resolved) : resolved;
  } catch {
    return { valid: false, kid, reason: 'public key could not be parsed' };
  }
  let valid: boolean;
  try {
    valid = verify(null, Buffer.from(canonicalBytes), key, Buffer.from(encoded, 'base64url'));
  } catch {
    return { valid: false, kid, reason: 'signature bytes could not be decoded' };
  }
  return { valid, kid };
}

/** Convenience: verify a row's signature end to end from its `AuditSignable`. */
export function verifyAuditRow(
  row: AuditSignable,
  signatureValue: string,
  resolvePublicKey: PublicKeyResolver,
): Ed25519VerifyResult {
  return verifyEd25519AuditSignature(auditSignableBytes(row), signatureValue, resolvePublicKey);
}
