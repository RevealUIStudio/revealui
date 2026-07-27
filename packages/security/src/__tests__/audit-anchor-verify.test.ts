import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyAuditAnchorOffline } from '../audit-anchor-verify.js';
import {
  buildInclusionProof,
  buildMerkleRootFromSignatures,
  hashAuditSignatureLeaf,
  signAuditAnchorRoot,
} from '../audit-merkle.js';
import { Ed25519AuditRowSigner } from '../audit-signing.js';

// Ed25519AuditRowSigner is in audit-signing (re-export path used by verify tests)

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

describe('verifyAuditAnchorOffline (GAP-355 S4-5)', () => {
  it('accepts a valid root-only verification', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const sigs = ['a', 'b', 'c'];
    const { root, leafCount } = buildMerkleRootFromSignatures(sigs);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 10,
      seqTo: 12,
      leafCount,
      root,
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
    });
    expect(result.ok).toBe(true);
    expect(result.checks.some((c) => c.includes('VALID'))).toBe(true);
  });

  it('rejects a tampered root', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['x', 'y']);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 1,
      seqTo: 2,
      leafCount,
      root,
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: {
        ...anchorBase,
        root: 'a'.repeat(64),
        rootSignature,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts root + inclusion proof for one leaf', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const sigs = ['s0', 's1', 's2', 's3'];
    const { root, leafCount, leafHashes } = buildMerkleRootFromSignatures(sigs);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 100,
      seqTo: 103,
      leafCount,
      root,
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);
    const leafIndex = 2;
    const proof = buildInclusionProof(leafHashes, leafIndex);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
      inclusion: {
        seq: 102,
        signature: 's2',
        leafHash: hashAuditSignatureLeaf('s2'),
        proof,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.checks.some((c) => c.includes('inclusion proof VALID'))).toBe(true);
  });

  it('rejects inclusion proof for wrong leaf signature', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const sigs = ['s0', 's1'];
    const { root, leafCount, leafHashes } = buildMerkleRootFromSignatures(sigs);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 1,
      seqTo: 2,
      leafCount,
      root,
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);
    const proof = buildInclusionProof(leafHashes, 0);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
      inclusion: {
        seq: 1,
        signature: 'WRONG',
        proof,
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe('verifyAuditAnchorOffline holes (GAP-447)', () => {
  it('back-compat: a pre-change anchor (no holes field at all) still verifies', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a', 'b']);
    // Simulates an anchor signed BEFORE GAP-447 (signAuditAnchorRoot invoked
    // with no `holes` key at all — not even `holes: undefined`).
    const anchorBase = { tenant: 'acct_t', seqFrom: 1, seqTo: 2, leafCount, root };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts an anchor with burned + foreign holes covered by the signature', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a', 'b']);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 10,
      seqTo: 13,
      leafCount,
      root,
      holes: { burned: [11], foreign: 1 },
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when the holes shipped with the anchor were not part of the signed payload', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a', 'b']);
    // span (10..11) == leafCount (2) so this signs cleanly WITHOUT holes.
    const anchorBase = { tenant: 'acct_t', seqFrom: 10, seqTo: 11, leafCount, root };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase); // signed WITHOUT holes

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      // Anchor now claims an (empty) holes object that was never part of the
      // signed payload — the omitted-key vs explicit-empty-object distinction
      // must change the signed bytes, so this must NOT verify.
      anchor: { ...anchorBase, holes: { burned: [], foreign: 0 }, rootSignature },
    });
    expect(result.ok).toBe(false);
  });

  it('skips the live burned-seq recheck when no checker is injected (true offline mode)', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a']);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 5,
      seqTo: 6,
      leafCount,
      root,
      holes: { burned: [6], foreign: 0 },
    };
    // seqFrom..seqTo spans 5..6 with leafCount 1: seq 5 is the one leaf, seq 6
    // is the recorded-burned hole traversed above it.
    const anchorWithSingleLeafRange = { ...anchorBase, seqFrom: 5, seqTo: 6, leafCount: 1 };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorWithSingleLeafRange);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorWithSingleLeafRange, rootSignature },
    });
    expect(result.ok).toBe(true);
    expect(result.checks.some((c) => c.includes('recheck skipped'))).toBe(true);
  });

  it('passes the live burned-seq recheck when the injected checker confirms absence', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a']);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 5,
      seqTo: 6,
      leafCount,
      root,
      holes: { burned: [6], foreign: 0 },
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
      checkBurnedSeqAbsent: async () => false,
    });
    expect(result.ok).toBe(true);
    expect(result.checks.some((c) => c.includes('confirmed still absent'))).toBe(true);
  });

  it('fails with a distinct error when a row now exists at a recorded-burned seq', async () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = new Ed25519AuditRowSigner(privateKeyPem, 'kid-v');
    const { root, leafCount } = buildMerkleRootFromSignatures(['a']);
    const anchorBase = {
      tenant: 'acct_t',
      seqFrom: 5,
      seqTo: 6,
      leafCount,
      root,
      holes: { burned: [6], foreign: 0 },
    };
    const { value: rootSignature } = signAuditAnchorRoot(signer, anchorBase);

    const result = await verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
      checkBurnedSeqAbsent: async (seq) => seq === 6, // tamper: a row now exists at the burned seq
    });
    expect(result.ok).toBe(false);
    expect(result.checks.some((c) => c.includes('now exists') && c.includes('tamper'))).toBe(true);
  });
});
