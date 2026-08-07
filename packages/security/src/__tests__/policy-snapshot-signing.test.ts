import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPolicySnapshotSignerFromEnv } from '../policy-snapshot-signer-env.js';
import {
  createPolicySnapshotSigner,
  policySnapshotSignableBytes,
  signPolicySnapshot,
  UNSIGNED_POLICY_KEY_ID,
  UNSIGNED_POLICY_SIGNATURE,
  verifyPolicySnapshot,
} from '../policy-snapshot-signing.js';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

describe('policy snapshot signing (GAP-381 I-5)', () => {
  it('signs and verifies a snapshot round-trip', () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = createPolicySnapshotSigner(privateKeyPem, 'policy-kid-1');
    const body = {
      version: 1,
      issuedAt: '2026-08-07T12:00:00.000Z',
      rules: [{ kind: 'pre-shell', permission: 'deny', reason: 'no shell' }],
    };
    const { keyId, signature } = signPolicySnapshot(body, signer);
    expect(keyId).toBe('policy-kid-1');
    expect(signature.startsWith('v1.ed25519.policy-kid-1.')).toBe(true);

    const result = verifyPolicySnapshot({ ...body, keyId, signature }, (kid) =>
      kid === 'policy-kid-1' ? publicKeyPem : null,
    );
    expect(result.valid).toBe(true);
  });

  it('fails when rules are tampered after signing', () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const signer = createPolicySnapshotSigner(privateKeyPem, 'k1');
    const body = {
      version: 1,
      issuedAt: '2026-08-07T12:00:00.000Z',
      rules: [] as const,
    };
    const { keyId, signature } = signPolicySnapshot(body, signer);
    const tampered = {
      version: 1,
      issuedAt: body.issuedAt,
      rules: [{ kind: 'pre-tool', permission: 'deny' as const, reason: 'attacker' }],
      keyId,
      signature,
    };
    expect(
      verifyPolicySnapshot(tampered, (kid) => (kid === 'k1' ? publicKeyPem : null)).valid,
    ).toBe(false);
  });

  it('rejects unsigned structure-only placeholders', () => {
    const result = verifyPolicySnapshot(
      {
        version: 1,
        issuedAt: '2026-08-07T12:00:00.000Z',
        rules: [],
        keyId: UNSIGNED_POLICY_KEY_ID,
        signature: UNSIGNED_POLICY_SIGNATURE,
      },
      () => null,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsigned/i);
  });

  it('canonical bytes are stable for the same body', () => {
    const body = {
      version: 2,
      issuedAt: '2026-08-07T00:00:00.000Z',
      rules: [{ b: 2, a: 1 }],
    };
    const a = policySnapshotSignableBytes(body);
    const b = policySnapshotSignableBytes(body);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe('createPolicySnapshotSignerFromEnv', () => {
  it('unsigned mode when no keys configured', () => {
    const resolution = createPolicySnapshotSignerFromEnv({});
    expect(resolution.mode).toBe('unsigned');
    expect(resolution.cryptoSigner).toBeUndefined();
  });

  it('signed mode from REVEALUI_POLICY_SIGNING_KEY', () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const resolution = createPolicySnapshotSignerFromEnv({
      REVEALUI_POLICY_SIGNING_KEY: privateKeyPem,
      REVEALUI_POLICY_PUBLIC_KEY: publicKeyPem,
      REVEALUI_POLICY_SIGNING_KID: 'env-kid',
    });
    expect(resolution.mode).toBe('signed');
    expect(resolution.kid).toBe('env-kid');
    expect(resolution.cryptoSigner).toBeDefined();

    const body = { version: 1, issuedAt: '2026-08-07T12:00:00.000Z', rules: [] };
    const signed = signPolicySnapshot(body, resolution.cryptoSigner!);
    expect(
      verifyPolicySnapshot(
        { ...body, keyId: signed.keyId, signature: signed.signature },
        resolution.resolvePublicKey,
      ).valid,
    ).toBe(true);
  });

  it('falls back to audit signing key when policy key absent', () => {
    const { privateKeyPem, publicKeyPem } = makeKeypair();
    const resolution = createPolicySnapshotSignerFromEnv({
      REVEALUI_AUDIT_SIGNING_KEY: privateKeyPem,
      REVEALUI_AUDIT_PUBLIC_KEY: publicKeyPem,
      REVEALUI_AUDIT_SIGNING_KID: 'audit-kid',
    });
    expect(resolution.mode).toBe('signed');
    expect(resolution.kid).toBe('audit-kid');
  });
});
