import { generateKeyPairSync } from 'node:crypto';
import {
  buildMerkleRootFromSignatures,
  Ed25519AuditRowSigner,
  signAuditAnchorRoot,
} from '@revealui/security/server';
import { describe, expect, it } from 'vitest';
import { buildAnchorInclusionProof } from '../audit-anchor-proof.js';

describe('buildAnchorInclusionProof (GAP-355 S4-4)', () => {
  it('proves every seq in a 3-leaf anchor', () => {
    const sigs = ['sig-a', 'sig-b', 'sig-c'];
    const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
    const rows = sigs.map((signature, i) => ({ seq: 10 + i, signature }));
    const anchor = { seqFrom: 10, seqTo: 12, root, leafCount };

    for (let seq = 10; seq <= 12; seq++) {
      const result = buildAnchorInclusionProof(anchor, rows, seq);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.leafIndex).toBe(seq - 10);
        expect(result.recomputedRoot).toBe(root);
      }
    }
  });

  it('rejects seq outside range', () => {
    const sigs = ['x', 'y'];
    const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
    const rows = [
      { seq: 1, signature: 'x' },
      { seq: 2, signature: 'y' },
    ];
    const r = buildAnchorInclusionProof({ seqFrom: 1, seqTo: 2, root, leafCount }, rows, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SEQ_OUT_OF_RANGE');
  });

  it('rejects when stored root does not match rows (tamper)', () => {
    const sigs = ['a', 'b'];
    const { leafCount } = buildMerkleRootFromSignatures(sigs);
    const rows = [
      { seq: 1, signature: 'a' },
      { seq: 2, signature: 'b' },
    ];
    const r = buildAnchorInclusionProof(
      { seqFrom: 1, seqTo: 2, root: '0'.repeat(64), leafCount },
      rows,
      1,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ROOT_MISMATCH');
  });

  describe('GAP-447: holes-carrying anchors (non-contiguous rows)', () => {
    it('proves a seq when the row set has real gaps (burned/foreign seqs traversed)', () => {
      // Anchor range 10..14, but only seq 10, 12, 14 are real leaves — 11 and
      // 13 were traversed holes (burned or foreign-scope), not part of `rows`.
      const sigs = ['sig-10', 'sig-12', 'sig-14'];
      const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
      const rows = [
        { seq: 10, signature: 'sig-10' },
        { seq: 12, signature: 'sig-12' },
        { seq: 14, signature: 'sig-14' },
      ];
      const anchor = { seqFrom: 10, seqTo: 14, root, leafCount };

      const result = buildAnchorInclusionProof(anchor, rows, 12);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Position-based (index 1), NOT seq - seqFrom (which would be 2).
        expect(result.leafIndex).toBe(1);
        expect(result.recomputedRoot).toBe(root);
      }
    });

    it('rejects a seq inside the range but not among the actual leaves (a hole itself)', () => {
      const sigs = ['sig-10', 'sig-12'];
      const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
      const rows = [
        { seq: 10, signature: 'sig-10' },
        { seq: 12, signature: 'sig-12' },
      ];
      const anchor = { seqFrom: 10, seqTo: 12, root, leafCount };

      // seq 11 is in [seqFrom, seqTo] but was a traversed hole, not a leaf.
      const result = buildAnchorInclusionProof(anchor, rows, 11);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('MISSING_LEAF');
    });

    it('rejects out-of-order rows even within a valid range', () => {
      const sigs = ['sig-10', 'sig-12'];
      const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
      const rows = [
        { seq: 12, signature: 'sig-12' },
        { seq: 10, signature: 'sig-10' },
      ];
      const result = buildAnchorInclusionProof(
        { seqFrom: 10, seqTo: 12, root, leafCount },
        rows,
        10,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('MISSING_LEAF');
    });
  });

  it('smoke: root signature envelope still binds range (S4-2)', () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const signer = new Ed25519AuditRowSigner(pem, 'kid-t');
    const { root, leafCount } = buildMerkleRootFromSignatures(['p', 'q']);
    const { value } = signAuditAnchorRoot(signer, {
      tenant: 'acct_1',
      seqFrom: 1,
      seqTo: 2,
      leafCount,
      root,
    });
    expect(value.startsWith('v1.ed25519.kid-t.')).toBe(true);
  });
});
