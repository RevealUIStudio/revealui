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
  it('accepts a valid root-only verification', () => {
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

    const result = verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: { ...anchorBase, rootSignature },
    });
    expect(result.ok).toBe(true);
    expect(result.checks.some((c) => c.includes('VALID'))).toBe(true);
  });

  it('rejects a tampered root', () => {
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

    const result = verifyAuditAnchorOffline({
      publicKeyPem,
      anchor: {
        ...anchorBase,
        root: 'a'.repeat(64),
        rootSignature,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts root + inclusion proof for one leaf', () => {
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

    const result = verifyAuditAnchorOffline({
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

  it('rejects inclusion proof for wrong leaf signature', () => {
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

    const result = verifyAuditAnchorOffline({
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
