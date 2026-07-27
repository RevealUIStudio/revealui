/**
 * Offline audit-anchor verification (GAP-355 Stage 4 S4-5; extended GAP-447).
 *
 * Core verification (root signature + inclusion proof) is a pure library: no
 * network, no database. Customers (and `verify-audit-anchor` CLI) pass a
 * published SPKI public key, a root record (from API download or export), and
 * optionally an inclusion proof for one row signature.
 *
 * GAP-447 adds one OPTIONAL live recheck on top of that pure core: an anchor
 * may carry `holes.burned` seqs (traversed because no row existed there at
 * anchor-build time). Since `audit_log.seq` is written explicitly by the
 * store (not purely DB-generated per row — see `nextSeqValues` in
 * `@revealui/db`'s `DrizzleAuditStore`), a "burned" seq could later be filled
 * by a forged row, which would be a real integrity violation the signed
 * payload alone cannot detect (it only proves what was true when signed). A
 * caller with DB access may inject `checkBurnedSeqAbsent` to re-verify each
 * recorded-burned seq is STILL absent right now. When omitted (the true
 * "no network, no database" mode — e.g. the CLI verifying a customer-held
 * export), that recheck is skipped and only the root + inclusion proof are
 * verified.
 *
 * Exit contract for CLI consumers:
 *   - root signature must verify over JCS { tenant, seqFrom, seqTo, leafCount, root[, holes] }
 *   - if proof present: leaf = SHA-256(signature), inclusion path must recompute root
 *   - if checkBurnedSeqAbsent provided and holes.burned non-empty: every burned seq
 *     must still be absent, or verification fails with a distinct reason
 */

import {
  type AuditAnchorHoles,
  type AuditAnchorSignable,
  hashAuditSignatureLeaf,
  type InclusionProof,
  verifyAuditAnchorRoot,
  verifyInclusionProof,
} from './audit-merkle.js';
import type { PublicKeyResolver } from './audit-signing.js';

/** Injected DB-aware check: does a row currently exist at this seq (for the anchor's scope)? */
export type SeqExistsChecker = (seq: number) => Promise<boolean>;

export interface OfflineAnchorRecord extends AuditAnchorSignable {
  /** Stage-3 style envelope: v1.ed25519.<kid>.<sig> */
  rootSignature: string;
}

export interface OfflineInclusionProofInput {
  /** Audit log seq covered by the anchor range. */
  seq: number;
  /** Row signature string (leaf preimage). */
  signature: string;
  /** Merkle inclusion path (from API / proof export). */
  proof: InclusionProof;
  /** Optional leaf hash; if set, must match SHA-256(signature). */
  leafHash?: string;
}

export interface OfflineVerifyInput {
  /** SPKI PEM public key that verifies the root (and any kid in the envelope). */
  publicKeyPem: string;
  anchor: OfflineAnchorRecord;
  inclusion?: OfflineInclusionProofInput;
  /**
   * GAP-447: optional live recheck that every seq in `anchor.holes.burned` is
   * STILL absent. Omit for a true offline verify (no DB access available);
   * provide when the caller has a live audit_log to re-check against.
   */
  checkBurnedSeqAbsent?: SeqExistsChecker;
}

export interface OfflineVerifyResult {
  ok: boolean;
  /** Human-readable checks (pass or fail). */
  checks: string[];
  kid?: string;
}

function singleKeyResolver(publicKeyPem: string): PublicKeyResolver {
  return (_kid: string) => publicKeyPem;
}

/**
 * Recheck (GAP-447) that every recorded-burned seq is STILL absent. Skipped
 * (ok:true, informational check only) when either there are no burned seqs to
 * check or no `checkBurnedSeqAbsent` was injected — the pure offline mode.
 */
async function verifyBurnedSeqsStillAbsent(
  holes: AuditAnchorHoles | undefined,
  checkBurnedSeqAbsent: SeqExistsChecker | undefined,
): Promise<{ ok: boolean; checks: string[] }> {
  const burned = holes?.burned ?? [];
  if (burned.length === 0) return { ok: true, checks: [] };
  if (!checkBurnedSeqAbsent) {
    return {
      ok: true,
      checks: [
        `${burned.length} burned seq(s) recorded; liveness recheck skipped (no checkBurnedSeqAbsent provided)`,
      ],
    };
  }
  for (const seq of burned) {
    const exists = await checkBurnedSeqAbsent(seq);
    if (exists) {
      return {
        ok: false,
        checks: [
          `burned seq ${seq} recorded as permanently absent, but a row now exists at that seq — anchor integrity violated (possible tamper)`,
        ],
      };
    }
  }
  return { ok: true, checks: [`${burned.length} burned seq(s) confirmed still absent`] };
}

/**
 * Verify an anchor root signature and optional inclusion proof offline, plus
 * (GAP-447, optional) a live recheck that recorded-burned seqs are still
 * absent. Never throws for expected invalid crypto; returns ok:false + reasons.
 */
export async function verifyAuditAnchorOffline(
  input: OfflineVerifyInput,
): Promise<OfflineVerifyResult> {
  const checks: string[] = [];
  const { publicKeyPem, anchor, inclusion, checkBurnedSeqAbsent } = input;

  if (!(publicKeyPem.includes('BEGIN PUBLIC KEY') || publicKeyPem.includes('BEGIN'))) {
    // Allow raw PEM without forcing exact header wording; empty is hard fail.
    if (publicKeyPem.trim().length === 0) {
      return { ok: false, checks: ['public key PEM is empty'] };
    }
  }

  let anchorSignable: AuditAnchorSignable;
  try {
    anchorSignable = {
      tenant: anchor.tenant,
      seqFrom: anchor.seqFrom,
      seqTo: anchor.seqTo,
      leafCount: anchor.leafCount,
      root: anchor.root,
      ...(anchor.holes !== undefined ? { holes: anchor.holes } : {}),
    };
    // Validate shape via auditAnchorSignableBytes rules by calling verify path
  } catch (err) {
    return {
      ok: false,
      checks: [`invalid anchor shape: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  let rootResult: { valid: boolean; kid?: string; reason?: string };
  try {
    rootResult = verifyAuditAnchorRoot(
      anchorSignable,
      anchor.rootSignature,
      singleKeyResolver(publicKeyPem),
    );
  } catch (err) {
    return {
      ok: false,
      checks: [`root signature verify threw: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!rootResult.valid) {
    checks.push(`root signature INVALID: ${rootResult.reason ?? 'unknown'}`);
    return { ok: false, checks, kid: rootResult.kid };
  }
  checks.push(
    `root signature VALID (tenant=${anchor.tenant} seq=${anchor.seqFrom}..${anchor.seqTo} leaves=${anchor.leafCount})`,
  );

  if (!inclusion) {
    checks.push('no inclusion proof provided (root-only verify)');
    const holesResult = await verifyBurnedSeqsStillAbsent(anchor.holes, checkBurnedSeqAbsent);
    checks.push(...holesResult.checks);
    return { ok: holesResult.ok, checks, kid: rootResult.kid };
  }

  // Inclusion proof path
  if (inclusion.seq < anchor.seqFrom || inclusion.seq > anchor.seqTo) {
    checks.push(
      `inclusion seq ${inclusion.seq} outside anchor range ${anchor.seqFrom}..${anchor.seqTo}`,
    );
    return { ok: false, checks, kid: rootResult.kid };
  }

  const expectedLeafIndex = inclusion.seq - anchor.seqFrom;
  if (inclusion.proof.leafIndex !== expectedLeafIndex) {
    checks.push(`proof.leafIndex ${inclusion.proof.leafIndex} != seq-seqFrom ${expectedLeafIndex}`);
    return { ok: false, checks, kid: rootResult.kid };
  }
  if (inclusion.proof.leafCount !== anchor.leafCount) {
    checks.push(
      `proof.leafCount ${inclusion.proof.leafCount} != anchor.leafCount ${anchor.leafCount}`,
    );
    return { ok: false, checks, kid: rootResult.kid };
  }

  let leafHex: string;
  try {
    leafHex = hashAuditSignatureLeaf(inclusion.signature);
  } catch (err) {
    checks.push(`leaf hash failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, checks, kid: rootResult.kid };
  }

  if (inclusion.leafHash && inclusion.leafHash !== leafHex) {
    checks.push('provided leafHash does not match SHA-256(signature)');
    return { ok: false, checks, kid: rootResult.kid };
  }

  const pathOk = verifyInclusionProof(leafHex, inclusion.proof, anchor.root);
  if (!pathOk) {
    checks.push('inclusion proof does NOT recompute to stored Merkle root');
    return { ok: false, checks, kid: rootResult.kid };
  }

  checks.push(`inclusion proof VALID for seq=${inclusion.seq} leafIndex=${expectedLeafIndex}`);

  const holesResult = await verifyBurnedSeqsStillAbsent(anchor.holes, checkBurnedSeqAbsent);
  checks.push(...holesResult.checks);
  return { ok: holesResult.ok, checks, kid: rootResult.kid };
}
