import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  assertContiguousSeq,
  auditAnchorSignableBytes,
  buildInclusionProof,
  buildMerkleRootFromSignatures,
  hashAuditSignatureLeaf,
  signAuditAnchorRoot,
  verifyAuditAnchorRoot,
  verifyInclusionProof,
} from '../audit-merkle.js';
import { Ed25519AuditRowSigner } from '../audit-signing.js';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

describe('audit Merkle (GAP-355 Stage 4 S4-2)', () => {
  let priv: string;
  let pub: string;
  let signer: Ed25519AuditRowSigner;

  beforeAll(() => {
    const kp = makeKeypair();
    priv = kp.privateKeyPem;
    pub = kp.publicKeyPem;
    signer = new Ed25519AuditRowSigner(priv, 'kid-merkle');
  });

  it('hashes leaves deterministically', () => {
    const a = hashAuditSignatureLeaf('v1.ed25519.kid.sigA');
    const b = hashAuditSignatureLeaf('v1.ed25519.kid.sigA');
    const c = hashAuditSignatureLeaf('v1.ed25519.kid.sigB');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toBe(c);
  });

  it('rejects empty signature leaf', () => {
    expect(() => hashAuditSignatureLeaf('')).toThrow(/non-empty/);
  });

  it('assertContiguousSeq accepts tight ranges and rejects gaps', () => {
    expect(() => assertContiguousSeq([10, 11, 12])).not.toThrow();
    expect(() => assertContiguousSeq([10, 12])).toThrow(/gap/);
    expect(() => assertContiguousSeq([])).toThrow(/empty/);
  });

  it('builds a stable root for ordered signatures', () => {
    const sigs = ['sig-1', 'sig-2', 'sig-3', 'sig-4'];
    const a = buildMerkleRootFromSignatures(sigs);
    const b = buildMerkleRootFromSignatures(sigs);
    expect(a.root).toBe(b.root);
    expect(a.leafCount).toBe(4);
    expect(a.leafHashes).toHaveLength(4);
  });

  it('root changes when any leaf signature changes (tamper)', () => {
    const base = buildMerkleRootFromSignatures(['a', 'b', 'c']);
    const tampered = buildMerkleRootFromSignatures(['a', 'b-X', 'c']);
    expect(tampered.root).not.toBe(base.root);
  });

  it('root changes when leaf order changes', () => {
    const a = buildMerkleRootFromSignatures(['x', 'y', 'z']);
    const b = buildMerkleRootFromSignatures(['z', 'y', 'x']);
    expect(a.root).not.toBe(b.root);
  });

  it('single leaf root equals the leaf hash', () => {
    const sig = 'only-one';
    const { root, leafHashes } = buildMerkleRootFromSignatures([sig]);
    expect(root).toBe(leafHashes[0]);
    expect(root).toBe(hashAuditSignatureLeaf(sig));
  });

  it('inclusion proof verifies for every leaf index', () => {
    const sigs = ['s0', 's1', 's2', 's3', 's4']; // odd count exercises duplicate-last
    const { root, leafHashes } = buildMerkleRootFromSignatures(sigs);
    for (let i = 0; i < leafHashes.length; i++) {
      const proof = buildInclusionProof(leafHashes, i);
      const leaf = leafHashes[i];
      expect(leaf).toBeDefined();
      expect(verifyInclusionProof(leaf as string, proof, root)).toBe(true);
    }
  });

  it('inclusion proof fails for wrong leaf or wrong root', () => {
    const { root, leafHashes } = buildMerkleRootFromSignatures(['p', 'q', 'r']);
    const proof = buildInclusionProof(leafHashes, 1);
    expect(verifyInclusionProof(leafHashes[0] as string, proof, root)).toBe(false);
    expect(verifyInclusionProof(leafHashes[1] as string, proof, '0'.repeat(64))).toBe(false);
  });

  it('signs and verifies an anchor root with range binding', () => {
    const sigs = ['row-sig-1', 'row-sig-2', 'row-sig-3'];
    assertContiguousSeq([100, 101, 102]);
    const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
    const anchor = {
      tenant: 'acct_demo',
      seqFrom: 100,
      seqTo: 102,
      leafCount,
      root,
    };
    const { value } = signAuditAnchorRoot(signer, anchor);
    expect(value.startsWith('v1.ed25519.kid-merkle.')).toBe(true);
    expect(
      verifyAuditAnchorRoot(anchor, value, (kid) => (kid === 'kid-merkle' ? pub : null)).valid,
    ).toBe(true);
  });

  it('anchor verify fails when root or range is tampered', () => {
    const { root, leafCount } = buildMerkleRootFromSignatures(['a', 'b']);
    const anchor = {
      tenant: 't1',
      seqFrom: 1,
      seqTo: 2,
      leafCount,
      root,
    };
    const { value } = signAuditAnchorRoot(signer, anchor);
    const resolve = (kid: string) => (kid === 'kid-merkle' ? pub : null);
    expect(verifyAuditAnchorRoot({ ...anchor, root: 'a'.repeat(64) }, value, resolve).valid).toBe(
      false,
    );
    expect(verifyAuditAnchorRoot({ ...anchor, tenant: 'other' }, value, resolve).valid).toBe(false);
  });

  it('anchor signable rejects leafCount that does not match seq span', () => {
    expect(() =>
      auditAnchorSignableBytes({
        tenant: 't',
        seqFrom: 1,
        seqTo: 3,
        leafCount: 2,
        root: 'b'.repeat(64),
      }),
    ).toThrow(/leafCount/);
  });

  describe('holes (GAP-447)', () => {
    it('an undefined holes field serializes IDENTICALLY to no holes field at all', () => {
      const base = { tenant: 't', seqFrom: 1, seqTo: 2, leafCount: 2, root: 'c'.repeat(64) };
      const withoutKey = auditAnchorSignableBytes(base);
      const withUndefined = auditAnchorSignableBytes({ ...base, holes: undefined });
      expect(new TextDecoder().decode(withoutKey)).toBe(new TextDecoder().decode(withUndefined));
    });

    it('an explicit (even empty) holes object changes the signed bytes', () => {
      const base = { tenant: 't', seqFrom: 1, seqTo: 2, leafCount: 2, root: 'c'.repeat(64) };
      const withoutHoles = auditAnchorSignableBytes(base);
      const withEmptyHoles = auditAnchorSignableBytes({
        ...base,
        holes: { burned: [], foreign: 0 },
      });
      expect(new TextDecoder().decode(withoutHoles)).not.toBe(
        new TextDecoder().decode(withEmptyHoles),
      );
    });

    it('leafCount must equal the seq span MINUS the traversed holes', () => {
      // span 1..4 = 4 seqs; 1 burned + 1 foreign traversed ⇒ 2 real leaves.
      expect(() =>
        auditAnchorSignableBytes({
          tenant: 't',
          seqFrom: 1,
          seqTo: 4,
          leafCount: 2,
          root: 'd'.repeat(64),
          holes: { burned: [2], foreign: 1 },
        }),
      ).not.toThrow();
      expect(() =>
        auditAnchorSignableBytes({
          tenant: 't',
          seqFrom: 1,
          seqTo: 4,
          leafCount: 4, // wrong: ignores the holes
          root: 'd'.repeat(64),
          holes: { burned: [2], foreign: 1 },
        }),
      ).toThrow(/leafCount/);
    });

    it('rejects a burned seq outside the seqFrom..seqTo range', () => {
      expect(() =>
        auditAnchorSignableBytes({
          tenant: 't',
          seqFrom: 1,
          seqTo: 2,
          leafCount: 1,
          root: 'e'.repeat(64),
          holes: { burned: [99], foreign: 0 },
        }),
      ).toThrow(/outside anchor range/);
    });

    it('signs and verifies an anchor carrying holes', () => {
      const sigs = ['h0', 'h1'];
      const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
      const anchor = {
        tenant: 'acct_holes',
        seqFrom: 10,
        seqTo: 13,
        leafCount,
        root,
        holes: { burned: [12], foreign: 1 },
      };
      const { value } = signAuditAnchorRoot(signer, anchor);
      expect(
        verifyAuditAnchorRoot(anchor, value, (kid) => (kid === 'kid-merkle' ? pub : null)).valid,
      ).toBe(true);
      // Tampering the holes after signing must invalidate the signature.
      const tampered = { ...anchor, holes: { burned: [13], foreign: 1 } };
      expect(
        verifyAuditAnchorRoot(tampered, value, (kid) => (kid === 'kid-merkle' ? pub : null)).valid,
      ).toBe(false);
    });
  });
});
