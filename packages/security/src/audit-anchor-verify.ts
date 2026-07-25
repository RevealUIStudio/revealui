/**
 * Offline audit-anchor verification (GAP-355 Stage 4 S4-5).
 *
 * Pure library: no network, no database. Customers (and `verify-audit-anchor`
 * CLI) pass a published SPKI public key, a root record (from API download or
 * export), and optionally an inclusion proof for one row signature.
 *
 * Exit contract for CLI consumers:
 *   - root signature must verify over JCS { tenant, seqFrom, seqTo, leafCount, root }
 *   - if proof present: leaf = SHA-256(signature), inclusion path must recompute root
 */

import {
  type AuditAnchorSignable,
  hashAuditSignatureLeaf,
  type InclusionProof,
  verifyAuditAnchorRoot,
  verifyInclusionProof,
} from './audit-merkle.js';
import type { PublicKeyResolver } from './audit-signing.js';

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
 * Verify an anchor root signature and optional inclusion proof offline.
 * Never throws for expected invalid crypto; returns ok:false + reasons.
 */
export function verifyAuditAnchorOffline(input: OfflineVerifyInput): OfflineVerifyResult {
  const checks: string[] = [];
  const { publicKeyPem, anchor, inclusion } = input;

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
    return { ok: true, checks, kid: rootResult.kid };
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
  return { ok: true, checks, kid: rootResult.kid };
}
