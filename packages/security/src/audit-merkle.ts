/**
 * Merkle roots over signed audit_log rows (GAP-355 Stage 4 S4-2).
 *
 * Leaves are SHA-256 digests of each row's **signature** string (already
 * integrity-bearing), ordered by `seq` ascending. Binary tree: when a level
 * has an odd count, the last node is duplicated (Bitcoin-style) so every
 * parent has two children. Root is lower-case hex of the SHA-256 of the
 * concatenated child digests (raw 32-byte digests, not hex).
 *
 * Root signing reuses Stage 3 `AuditRowSigner` / Ed25519 envelope
 * (`v1.ed25519.<kid>.<sig>`) over a JCS payload binding tenant + seq range +
 * leaf count + root hex.
 *
 * Worker sweep (S4-3), API proof (S4-4), and offline CLI (S4-5) consume this
 * library; this module does not touch the database.
 */

import { createHash } from 'node:crypto';
import type { AuditRowSigner } from './audit-signing.js';
import { type PublicKeyResolver, verifyEd25519AuditSignature } from './audit-signing.js';
import { canonicalizeJcs } from './jcs.js';

/** Lower-case hex SHA-256 of the UTF-8 signature column value. */
export function hashAuditSignatureLeaf(signature: string): string {
  if (signature.length === 0) {
    throw new Error('hashAuditSignatureLeaf: signature must be non-empty');
  }
  return createHash('sha256').update(signature, 'utf8').digest('hex');
}

/** SHA-256(left || right) where left/right are 32-byte digests (hex in, hex out). */
export function hashMerklePair(leftHex: string, rightHex: string): string {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== 32 || right.length !== 32) {
    throw new Error('hashMerklePair: expected 32-byte hex digests');
  }
  return createHash('sha256').update(left).update(right).digest('hex');
}

/**
 * Fail closed if `seq` values are not strictly increasing by 1 with no gaps.
 * Used by the worker before building a batch (design §4 step 3).
 */
export function assertContiguousSeq(seqs: readonly number[]): void {
  if (seqs.length === 0) {
    throw new Error('assertContiguousSeq: empty seq list');
  }
  for (let i = 1; i < seqs.length; i++) {
    const prev = seqs[i - 1];
    const cur = seqs[i];
    if (prev === undefined || cur === undefined) {
      throw new Error('assertContiguousSeq: undefined seq');
    }
    if (!(Number.isInteger(prev) && Number.isInteger(cur))) {
      throw new Error('assertContiguousSeq: seq must be integers');
    }
    if (cur !== prev + 1) {
      throw new Error(
        `assertContiguousSeq: gap or reorder at index ${i}: ${prev} → ${cur} (need ${prev + 1})`,
      );
    }
  }
}

export interface MerkleBuildResult {
  /** Lower-case hex Merkle root. */
  root: string;
  /** Leaf digests in input order (same length as input signatures). */
  leafHashes: string[];
  leafCount: number;
}

/**
 * Build a binary Merkle root over signature strings (leaf = SHA-256(signature)).
 * Empty input throws (anchors require leaf_count > 0).
 */
export function buildMerkleRootFromSignatures(signatures: readonly string[]): MerkleBuildResult {
  if (signatures.length === 0) {
    throw new Error('buildMerkleRootFromSignatures: need at least one signature');
  }
  const leafHashes = signatures.map((s) => hashAuditSignatureLeaf(s));
  let level = leafHashes.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      if (left === undefined) {
        throw new Error('buildMerkleRootFromSignatures: internal level gap');
      }
      const right = level[i + 1] ?? left; // odd: duplicate last
      next.push(hashMerklePair(left, right));
    }
    level = next;
  }
  const root = level[0];
  if (!root) {
    throw new Error('buildMerkleRootFromSignatures: empty root');
  }
  return { root, leafHashes, leafCount: leafHashes.length };
}

export interface InclusionProof {
  /** Index of the leaf among the batch (0-based). */
  leafIndex: number;
  leafCount: number;
  /**
   * Sibling digests from leaf toward root. For each step, `isRightSibling`
   * means the sibling is on the right of the current node (i.e. current is left).
   */
  path: Array<{ siblingHex: string; isRightSibling: boolean }>;
}

/**
 * Build an inclusion proof for `leafIndex` given the full ordered leaf hash list
 * (must match the list used to build the root).
 */
export function buildInclusionProof(
  leafHashes: readonly string[],
  leafIndex: number,
): InclusionProof {
  if (leafHashes.length === 0) {
    throw new Error('buildInclusionProof: empty leaves');
  }
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leafHashes.length) {
    throw new Error(`buildInclusionProof: leafIndex ${leafIndex} out of range`);
  }

  const path: InclusionProof['path'] = [];
  let level = leafHashes.slice();
  let index = leafIndex;

  while (level.length > 1) {
    const isLeft = index % 2 === 0;
    const pairIndex = isLeft ? index + 1 : index - 1;
    // Odd last leaf: paired with itself
    const siblingIndex = pairIndex >= level.length ? index : pairIndex;
    const siblingHex = level[siblingIndex];
    if (!siblingHex) {
      throw new Error('buildInclusionProof: missing sibling');
    }
    path.push({ siblingHex, isRightSibling: isLeft });

    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      if (left === undefined) throw new Error('buildInclusionProof: internal gap');
      const right = level[i + 1] ?? left;
      next.push(hashMerklePair(left, right));
    }
    level = next;
    index = Math.floor(index / 2);
  }

  return { leafIndex, leafCount: leafHashes.length, path };
}

/**
 * Recompute root from a leaf digest + inclusion proof. Returns true iff it
 * matches `expectedRoot`.
 */
export function verifyInclusionProof(
  leafHex: string,
  proof: InclusionProof,
  expectedRoot: string,
): boolean {
  if (leafHex.length !== 64 || expectedRoot.length !== 64) {
    return false;
  }
  let current = leafHex;
  for (const step of proof.path) {
    if (step.isRightSibling) {
      current = hashMerklePair(current, step.siblingHex);
    } else {
      current = hashMerklePair(step.siblingHex, current);
    }
  }
  return current === expectedRoot;
}

// ── Root signing (binds range + root) ─────────────────────────────────

/**
 * GAP-447: seqs traversed within an anchor's [seqFrom, seqTo] range that are
 * NOT among the anchor's own leaves — classified at sweep time from a single
 * existence query over the range, never guessed:
 *   - `burned`  — seqs with no audit_log row at all. The append-only trigger
 *     (migrations 0002 + 0026) makes deletion impossible, so an absent seq
 *     proves the value was consumed by `nextval()` without an INSERT landing
 *     (an aborted transaction), not a deletion. Enumerated individually so a
 *     verifier can re-check each is still absent (see `holes` on
 *     `AuditAnchorSignable`).
 *   - `foreign` — count of rows present at a traversed seq but scoped to a
 *     different tenant (or, for the system scope, any non-null tenant).
 *     Their existence already proves non-deletion, so only the count is
 *     signed — the individual seqs carry no anomaly signal worth re-checking.
 */
export interface AuditAnchorHoles {
  burned: readonly number[];
  foreign: number;
}

export interface AuditAnchorSignable {
  tenant: string;
  seqFrom: number;
  seqTo: number;
  leafCount: number;
  root: string;
  /**
   * GAP-447: holes traversed while building this anchor. Optional and
   * covered by the root signature when present — `undefined` serializes to
   * EXACTLY the pre-GAP-447 payload (the key is omitted, not signed as
   * `null`/`undefined`), so every anchor signed before this change still
   * verifies unchanged.
   */
  holes?: AuditAnchorHoles;
}

function assertValidHoles(anchor: AuditAnchorSignable): void {
  const holes = anchor.holes;
  if (holes === undefined) return;
  if (!Array.isArray(holes.burned)) {
    throw new Error('auditAnchorSignableBytes: holes.burned must be an array');
  }
  for (const seq of holes.burned) {
    if (!Number.isInteger(seq) || seq < anchor.seqFrom || seq > anchor.seqTo) {
      throw new Error(
        `auditAnchorSignableBytes: holes.burned seq ${seq} outside anchor range ${anchor.seqFrom}..${anchor.seqTo}`,
      );
    }
  }
  if (!Number.isInteger(holes.foreign) || holes.foreign < 0) {
    throw new Error('auditAnchorSignableBytes: holes.foreign must be a non-negative integer');
  }
}

/** Canonical bytes signed for an anchor root (shared by sign + verify). */
export function auditAnchorSignableBytes(anchor: AuditAnchorSignable): Uint8Array {
  if (anchor.tenant.length === 0) {
    throw new Error('auditAnchorSignableBytes: tenant required');
  }
  if (!(Number.isInteger(anchor.seqFrom) && Number.isInteger(anchor.seqTo))) {
    throw new Error('auditAnchorSignableBytes: seq must be integers');
  }
  if (anchor.seqTo < anchor.seqFrom) {
    throw new Error('auditAnchorSignableBytes: seqTo < seqFrom');
  }
  if (!Number.isInteger(anchor.leafCount) || anchor.leafCount <= 0) {
    throw new Error('auditAnchorSignableBytes: leafCount must be positive integer');
  }
  if (!/^[0-9a-f]{64}$/.test(anchor.root)) {
    throw new Error('auditAnchorSignableBytes: root must be 64-char lowercase hex');
  }
  assertValidHoles(anchor);
  // GAP-447: with holes traversed, the leaf count is the seq span MINUS the
  // burned + foreign seqs traversed within it (they occupy seq slots in the
  // range without contributing a leaf). No holes ⇒ identical to the original
  // "leafCount must equal the seq span" check.
  const holesCount = anchor.holes ? anchor.holes.burned.length + anchor.holes.foreign : 0;
  const expectedLeaves = anchor.seqTo - anchor.seqFrom + 1 - holesCount;
  if (anchor.leafCount !== expectedLeaves) {
    throw new Error(
      `auditAnchorSignableBytes: leafCount ${anchor.leafCount} != seq span ${expectedLeaves} (span=${anchor.seqTo - anchor.seqFrom + 1}, holes=${holesCount})`,
    );
  }
  const payload: Record<string, unknown> = {
    tenant: anchor.tenant,
    seqFrom: anchor.seqFrom,
    seqTo: anchor.seqTo,
    leafCount: anchor.leafCount,
    root: anchor.root,
  };
  if (anchor.holes !== undefined) {
    payload.holes = {
      burned: [...anchor.holes.burned].sort((a, b) => a - b),
      foreign: anchor.holes.foreign,
    };
  }
  const canonical = canonicalizeJcs(payload);
  return new TextEncoder().encode(canonical);
}

/** Sign an anchor payload; returns the Stage-3 style envelope string. */
export function signAuditAnchorRoot(
  signer: AuditRowSigner,
  anchor: AuditAnchorSignable,
): { value: string } {
  return signer.sign(auditAnchorSignableBytes(anchor));
}

/** Verify an anchor root signature envelope. */
export function verifyAuditAnchorRoot(
  anchor: AuditAnchorSignable,
  rootSignature: string,
  resolvePublicKey: PublicKeyResolver,
): { valid: boolean; kid?: string; reason?: string } {
  return verifyEd25519AuditSignature(
    auditAnchorSignableBytes(anchor),
    rootSignature,
    resolvePublicKey,
  );
}
