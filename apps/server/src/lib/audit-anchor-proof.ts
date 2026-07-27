/**
 * Pure helpers for GAP-355 Stage 4 S4-4 inclusion proofs over an anchor range.
 * GAP-447: an anchor's [seqFrom, seqTo] range may contain holes (burned seqs
 * + foreign-scope rows) traversed around the actual leaves, so `rows` is no
 * longer required to be contiguous — only strictly increasing, within range,
 * and exactly `leafCount` long.
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
 * Build an inclusion proof for `seq` given the anchor's actual signed rows
 * (ordered by seq ascending). GAP-447: rows need not be contiguous with each
 * other or with `seqFrom`/`seqTo` — an anchor with traversed holes has real
 * gaps in the range by design. `seq` itself must be one of `rows` (a burned
 * or foreign-scope seq traversed within the range is not a valid proof
 * target — it has no leaf to prove).
 */
export function buildAnchorInclusionProof(
  anchor: AnchorRange,
  /** Rows ordered by seq ascending — the anchor's actual leaves, one per signature. */
  rows: ReadonlyArray<{ seq: number; signature: string }>,
  seq: number,
): ProofBuildOk | ProofBuildErr {
  if (seq < anchor.seqFrom || seq > anchor.seqTo) {
    return { ok: false, error: `seq ${seq} outside anchor range`, code: 'SEQ_OUT_OF_RANGE' };
  }
  if (rows.length === 0) {
    return { ok: false, error: 'no signed rows for range', code: 'EMPTY' };
  }

  if (rows.length !== anchor.leafCount) {
    return {
      ok: false,
      error: `row count ${rows.length} != leafCount ${anchor.leafCount}`,
      code: 'MISSING_LEAF',
    };
  }

  // Enforce order + range coverage. Strictly increasing, not necessarily
  // contiguous — holes (burned seqs, foreign-scope rows) are legitimate gaps.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prev = i > 0 ? rows[i - 1] : undefined;
    if (!row || row.seq < anchor.seqFrom || row.seq > anchor.seqTo) {
      return {
        ok: false,
        error: `row at index ${i} has seq outside anchor range`,
        code: 'MISSING_LEAF',
      };
    }
    if (prev && row.seq <= prev.seq) {
      return {
        ok: false,
        error: `rows out of order at index ${i}`,
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

  // GAP-447: leaf index is the row's POSITION among the anchor's actual
  // leaves, not `seq - seqFrom` — that arithmetic assumed a contiguous range,
  // which no longer holds once holes are traversed within [seqFrom, seqTo].
  const leafIndex = rows.findIndex((r) => r.seq === seq);
  const signature = rows[leafIndex]?.signature;
  const leafHash = leafIndex >= 0 ? leafHashes[leafIndex] : undefined;
  if (leafIndex < 0 || !(signature && leafHash)) {
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
