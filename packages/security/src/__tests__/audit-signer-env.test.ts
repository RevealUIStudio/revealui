/**
 * GAP-355 Stage 3 (spec D4) — resolveAuditPublicKey keypair cross-check.
 *
 * When both `REVEALUI_AUDIT_PUBLIC_KEY` and `REVEALUI_AUDIT_SIGNING_KEY` are
 * present they must be the same keypair. A mismatch publishes a key that
 * verifies no row — silently so under a shared kid override — so it must throw
 * loudly, not quietly hand out a useless key.
 */

import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAuditRowSignerFromEnv, resolveAuditPublicKey } from '../audit-signer-env.js';

function keypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

describe('resolveAuditPublicKey', () => {
  it('unsigned mode (neither key) resolves to null (honest 404, not 500)', () => {
    expect(resolveAuditPublicKey({})).toBeNull();
  });

  it('derived path (private key only) resolves the public half unchanged', () => {
    const { privateKeyPem, publicKeyPem } = keypair();
    const resolved = resolveAuditPublicKey({ REVEALUI_AUDIT_SIGNING_KEY: privateKeyPem });
    expect(resolved).not.toBeNull();
    expect(resolved?.alg).toBe('ed25519');
    expect(resolved?.publicKeyPem.trim()).toBe(publicKeyPem.trim());
    expect(resolved?.kid.startsWith('ed25519-')).toBe(true);
  });

  it('explicit public key only (no private key) resolves unchanged, no cross-check', () => {
    const { publicKeyPem } = keypair();
    const resolved = resolveAuditPublicKey({ REVEALUI_AUDIT_PUBLIC_KEY: publicKeyPem });
    expect(resolved?.publicKeyPem.trim()).toBe(publicKeyPem.trim());
  });

  it('matched pair (both env vars, same keypair) passes the cross-check', () => {
    const { privateKeyPem, publicKeyPem } = keypair();
    const resolved = resolveAuditPublicKey({
      REVEALUI_AUDIT_SIGNING_KEY: privateKeyPem,
      REVEALUI_AUDIT_PUBLIC_KEY: publicKeyPem,
    });
    expect(resolved?.publicKeyPem.trim()).toBe(publicKeyPem.trim());
  });

  it('mismatched pair throws, naming both env vars (no key material)', () => {
    const a = keypair();
    const b = keypair();
    let thrown: Error | undefined;
    try {
      resolveAuditPublicKey({
        REVEALUI_AUDIT_SIGNING_KEY: a.privateKeyPem,
        REVEALUI_AUDIT_PUBLIC_KEY: b.publicKeyPem,
      });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown?.message).toContain('REVEALUI_AUDIT_PUBLIC_KEY');
    expect(thrown?.message).toContain('REVEALUI_AUDIT_SIGNING_KEY');
    // Never leak key material in the error.
    expect(thrown?.message).not.toContain(a.privateKeyPem.trim());
    expect(thrown?.message).not.toContain(b.publicKeyPem.trim());
  });

  it('mismatched pair still throws under a shared REVEALUI_AUDIT_SIGNING_KID (the silent-failure case)', () => {
    const a = keypair();
    const b = keypair();
    expect(() =>
      resolveAuditPublicKey({
        REVEALUI_AUDIT_SIGNING_KEY: a.privateKeyPem,
        REVEALUI_AUDIT_PUBLIC_KEY: b.publicKeyPem,
        REVEALUI_AUDIT_SIGNING_KID: 'ed25519-operator-pinned',
      }),
    ).toThrow('REVEALUI_AUDIT_PUBLIC_KEY');
  });
});

describe('createAuditRowSignerFromEnv', () => {
  it('resolves unsigned mode when no signing key is present', () => {
    const res = createAuditRowSignerFromEnv({});
    expect(res.mode).toBe('unsigned');
    expect(res.signer).toBeUndefined();
  });

  it('composes a signer and kid when a valid key is present', () => {
    const { privateKeyPem } = keypair();
    const res = createAuditRowSignerFromEnv({ REVEALUI_AUDIT_SIGNING_KEY: privateKeyPem });
    expect(res.mode).toBe('signed');
    expect(res.signer).toBeTypeOf('function');
    expect(res.kid?.startsWith('ed25519-')).toBe(true);
  });
});
