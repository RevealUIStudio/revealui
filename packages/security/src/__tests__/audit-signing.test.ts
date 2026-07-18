import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type AuditSignable,
  auditSignableBytes,
  classifyAuditSignature,
  Ed25519AuditRowSigner,
  verifyAuditRow,
  verifyEd25519AuditSignature,
} from '../audit-signing.js';

function makeKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function makeRow(overrides: Partial<AuditSignable> = {}): AuditSignable {
  return {
    id: 'row-1',
    sequence: 42,
    tenant: 'acct_123',
    timestamp: new Date('2026-07-18T00:00:00.000Z'),
    eventType: 'agent:tool:called',
    severity: 'info',
    agentId: 'agent-1',
    taskId: null,
    sessionId: 'sess-1',
    payload: { tool: 'read', args: { b: 2, a: 1 } },
    policyViolations: [],
    ...overrides,
  };
}

describe('Ed25519 audit signing (GAP-355 Stage 3)', () => {
  let priv: string;
  let pub: string;
  let signer: Ed25519AuditRowSigner;
  const resolve = (kid: string) => (kid === 'kid-1' ? pub : null);

  beforeAll(() => {
    const kp = makeKeypair();
    priv = kp.privateKeyPem;
    pub = kp.publicKeyPem;
    signer = new Ed25519AuditRowSigner(priv, 'kid-1');
  });

  it('signs and verifies a row round-trip', () => {
    const row = makeRow();
    const { value } = signer.sign(auditSignableBytes(row));
    expect(value.startsWith('v1.ed25519.kid-1.')).toBe(true);
    expect(verifyAuditRow(row, value, resolve).valid).toBe(true);
  });

  it('verification fails when ANY signed field is tampered', () => {
    const row = makeRow();
    const { value } = signer.sign(auditSignableBytes(row));
    for (const tampered of [
      makeRow({ severity: 'critical' }),
      makeRow({ agentId: 'attacker' }),
      makeRow({ payload: { tool: 'delete' } }),
      makeRow({ tenant: 'acct_other' }),
    ]) {
      expect(verifyAuditRow(tampered, value, resolve).valid).toBe(false);
    }
  });

  it('verification fails when the sequence is renumbered (binds row to slot)', () => {
    const row = makeRow({ sequence: 42 });
    const { value } = signer.sign(auditSignableBytes(row));
    expect(verifyAuditRow(makeRow({ sequence: 43 }), value, resolve).valid).toBe(false);
  });

  it('a Date and its equivalent ISO string produce identical signed bytes', () => {
    const a = auditSignableBytes(makeRow({ timestamp: new Date('2026-07-18T00:00:00.000Z') }));
    const b = auditSignableBytes(makeRow({ timestamp: '2026-07-18T00:00:00.000Z' }));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('signing is stable regardless of payload key order (canonicalization)', () => {
    const v1 = signer.sign(auditSignableBytes(makeRow({ payload: { a: 1, b: 2 } }))).value;
    const v2 = signer.sign(auditSignableBytes(makeRow({ payload: { b: 2, a: 1 } }))).value;
    expect(v1).toBe(v2);
  });

  it('verification fails for an unresolvable kid', () => {
    const row = makeRow();
    const { value } = signer.sign(auditSignableBytes(row));
    const result = verifyAuditRow(row, value, () => null);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no public key/);
  });

  it('verification fails (never throws) on a malformed signature value', () => {
    const bytes = auditSignableBytes(makeRow());
    expect(verifyEd25519AuditSignature(bytes, 'not-a-signature', resolve).valid).toBe(false);
    expect(verifyEd25519AuditSignature(bytes, 'v2.ed25519.kid-1.abc', resolve).valid).toBe(false);
    expect(verifyEd25519AuditSignature(bytes, 'v1.rsa.kid-1.abc', resolve).valid).toBe(false);
  });

  it('verification fails when a DIFFERENT key signed it', () => {
    const other = new Ed25519AuditRowSigner(makeKeypair().privateKeyPem, 'kid-1');
    const row = makeRow();
    const forged = other.sign(auditSignableBytes(row)).value;
    // kid resolves to OUR public key, but the bytes were signed by another key.
    expect(verifyAuditRow(row, forged, resolve).valid).toBe(false);
  });

  it('rejects a kid containing the "." delimiter', () => {
    expect(() => new Ed25519AuditRowSigner(priv, 'bad.kid')).toThrow(/kid/);
    expect(() => new Ed25519AuditRowSigner(priv, '')).toThrow(/kid/);
  });

  it('rejects a non-ed25519 private key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rsaPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() => new Ed25519AuditRowSigner(rsaPem, 'kid-1')).toThrow(/ed25519/);
  });

  describe('classifyAuditSignature', () => {
    it('classifies NULL as unsigned', () => {
      expect(classifyAuditSignature(null)).toBe('unsigned');
      expect(classifyAuditSignature(undefined)).toBe('unsigned');
    });
    it('classifies a bare hex value as a legacy HMAC', () => {
      expect(classifyAuditSignature('a1b2c3d4e5f6')).toBe('legacy-hmac');
    });
    it('classifies a v1.ed25519 value', () => {
      expect(classifyAuditSignature('v1.ed25519.kid-1.abc')).toBe('ed25519');
    });
    it('classifies an unknown dotted value as unknown', () => {
      expect(classifyAuditSignature('v9.dsa.k.s')).toBe('unknown');
    });
  });
});
