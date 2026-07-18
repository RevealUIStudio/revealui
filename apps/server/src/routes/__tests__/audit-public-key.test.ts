/**
 * GAP-355 Stage 3 (spec D4) — audit public-key endpoint.
 *
 * Exercises the 404 (unsigned) → 200 (signed) mode flip and asserts the served
 * SPKI PEM + kid match what a signer would derive, so a customer can verify a
 * receipt offline from exactly this key.
 */

import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { deriveAuditKid } from '@revealui/core/security';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import auditRoute from '../audit.js';

const KEY_ENVS = [
  'REVEALUI_AUDIT_SIGNING_KEY',
  'REVEALUI_AUDIT_PUBLIC_KEY',
  'REVEALUI_AUDIT_SIGNING_KID',
] as const;

function generateKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

describe('GET /api/audit/public-key (GAP-355 Stage 3, D4)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEY_ENVS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEY_ENVS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('answers 404 with an honest body when no signing key is configured (unsigned mode)', async () => {
    const res = await auditRoute.request('/public-key');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('answers 200 with the SPKI PEM + kid derived from REVEALUI_AUDIT_SIGNING_KEY', async () => {
    const { privateKeyPem, publicKeyPem } = generateKeypair();
    process.env.REVEALUI_AUDIT_SIGNING_KEY = privateKeyPem;

    const res = await auditRoute.request('/public-key');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { alg: string; kid: string; publicKeyPem: string };

    expect(body.alg).toBe('ed25519');
    // The served PEM is the SPKI public half of the signing key.
    const expectedKid = deriveAuditKid(createPublicKey(createPrivateKey(privateKeyPem)));
    expect(body.kid).toBe(expectedKid);
    expect(body.publicKeyPem.trim()).toBe(publicKeyPem.trim());
    expect(body.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('prefers REVEALUI_AUDIT_PUBLIC_KEY and honors the REVEALUI_AUDIT_SIGNING_KID override', async () => {
    const { publicKeyPem } = generateKeypair();
    process.env.REVEALUI_AUDIT_PUBLIC_KEY = publicKeyPem;
    process.env.REVEALUI_AUDIT_SIGNING_KID = 'ed25519-operator-pinned';

    const res = await auditRoute.request('/public-key');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kid: string; publicKeyPem: string };
    expect(body.kid).toBe('ed25519-operator-pinned');
    expect(body.publicKeyPem.trim()).toBe(publicKeyPem.trim());
  });
});
