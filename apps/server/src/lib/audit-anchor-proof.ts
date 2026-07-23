/**
 * Pure helpers for GAP-355 Stage 4 S4-4 inclusion proofs over an anchor range.
 */

import {
  buildInclusionProof,
  buildMerkleRootFromSignatures,
  hashAuditSignatureLeaf,
  type InclusionProof,
  verifyInclusionProof,
} from '@revealui/security/server';

export interface AnchorRange {
  seqFrom: number;
  seqTo: number;
  root: string;
  leafCount: number;
}

export interface ProofBuildOk {
  ok: true;
  seq: number;
  leafIndex: number;
  leafHash: string;
  signature: string;
  proof: InclusionProof;
  recomputedRoot: string;
}

export interface ProofBuildErr {
  ok: false;
  error: string;
  code: 'SEQ_OUT_OF_RANGE' | 'MISSING_LEAF' | 'ROOT_MISMATCH' | 'EMPTY';
}

/**
 * Build an inclusion proof for `seq` given ordered signed rows covering the
 * anchor range (must be contiguous seqFrom..seqTo with one signature each).
 */
export function buildAnchorInclusionProof(
  anchor: AnchorRange,
  /** Rows ordered by seq ascending, covering the full range. */
  rows: ReadonlyArray<{ seq: number; signature: string }>,
  seq: number,
): ProofBuildOk | ProofBuildErr {
  if (seq < anchor.seqFrom || seq > anchor.seqTo) {
    return { ok: false, error: `seq ${seq} outside anchor range`, code: 'SEQ_OUT_OF_RANGE' };
  }
  if (rows.length === 0) {
    return { ok: false, error: 'no signed rows for range', code: 'EMPTY' };
  }

  const expectedCount = anchor.seqTo - anchor.seqFrom + 1;
  if (rows.length !== expectedCount || rows.length !== anchor.leafCount) {
    return {
      ok: false,
      error: `row count ${rows.length} != leafCount ${anchor.leafCount}`,
      code: 'MISSING_LEAF',
    };
  }

  // Enforce order + coverage
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.seq !== anchor.seqFrom + i) {
      return {
        ok: false,
        error: `expected seq ${anchor.seqFrom + i} at index ${i}`,
        code: 'MISSING_LEAF',
      };
    }
  }

  const signatures = rows.map((r) => r.signature);
  const { root, leafHashes } = buildMerkleRootFromSignatures(signatures);
  if (root !== anchor.root) {
    return {
      ok: false,
      error: 'recomputed Merkle root does not match stored anchor root',
      code: 'ROOT_MISMATCH',
    };
  }

  const leafIndex = seq - anchor.seqFrom;
  const signature = rows[leafIndex]?.signature;
  const leafHash = leafHashes[leafIndex];
  if (!(signature && leafHash)) {
    return { ok: false, error: 'leaf missing', code: 'MISSING_LEAF' };
  }

  const proof = buildInclusionProof(leafHashes, leafIndex);
  if (!verifyInclusionProof(leafHash, proof, root)) {
    return { ok: false, error: 'proof verification failed', code: 'ROOT_MISMATCH' };
  }

  return {
    ok: true,
    seq,
    leafIndex,
    leafHash,
    signature,
    proof,
    recomputedRoot: root,
  };
}

/** Leaf hash of a single signature (for clients that only hold the signature). */
export function leafHashForSignature(signature: string): string {
  return hashAuditSignatureLeaf(signature);
}
