import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { validateLicenseKey } from '../license.js';
import { issueRevForgeLicense } from '../revforge-license.js';

let privateKey: string;
let publicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

describe('issueRevForgeLicense', () => {
  it('issues a JWT with the expected shape and metadata', async () => {
    const result = await issueRevForgeLicense(
      { slug: 'acme', tier: 'pro' },
      { privateKey, publicKey },
    );

    expect(result.licenseKey).toMatch(/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\..+/);
    expect(result.customerId).toBe('acme');
    expect(result.tier).toBe('pro');
    expect(result.perpetual).toBe(false);
    expect(result.expiresAt).not.toBeNull();
    expect(result.payload.tier).toBe('pro');
    expect(result.payload.customerId).toBe('acme');
  });

  it('round-trips: issued JWT validates back to the same payload', async () => {
    const result = await issueRevForgeLicense(
      {
        slug: 'bigcorp',
        tier: 'enterprise',
        maxSites: 50,
        maxUsers: 200,
        domains: ['bigcorp.example', 'admin.bigcorp.example'],
      },
      { privateKey, publicKey },
    );

    const verified = await validateLicenseKey(result.licenseKey, publicKey);

    expect(verified).not.toBeNull();
    expect(verified?.tier).toBe('enterprise');
    expect(verified?.customerId).toBe('bigcorp');
    expect(verified?.maxSites).toBe(50);
    expect(verified?.maxUsers).toBe(200);
    expect(verified?.domains).toEqual(['bigcorp.example', 'admin.bigcorp.example']);
  });

  it('omits exp claim for perpetual licenses', async () => {
    const result = await issueRevForgeLicense(
      { slug: 'forever', tier: 'enterprise', perpetual: true },
      { privateKey, publicKey },
    );

    expect(result.perpetual).toBe(true);
    expect(result.expiresAt).toBeNull();
    expect(result.payload.perpetual).toBe(true);

    const verified = await validateLicenseKey(result.licenseKey, publicKey);
    expect(verified).not.toBeNull();
    expect(verified?.exp).toBeUndefined();
    expect(verified?.perpetual).toBe(true);
  });

  it('honors expiresInDays', async () => {
    const before = Date.now();
    const result = await issueRevForgeLicense(
      { slug: 'trial', tier: 'enterprise', expiresInDays: 30 },
      { privateKey, publicKey },
    );
    const after = Date.now();

    const expMs = new Date(result.expiresAt ?? '').getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(expMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expMs).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });

  it('rejects invalid slugs', async () => {
    await expect(
      issueRevForgeLicense({ slug: 'BadSlug', tier: 'pro' }, { privateKey, publicKey }),
    ).rejects.toThrow(/Invalid --slug/);

    await expect(
      issueRevForgeLicense({ slug: '-leading-dash', tier: 'pro' }, { privateKey, publicKey }),
    ).rejects.toThrow(/Invalid --slug/);

    await expect(
      issueRevForgeLicense({ slug: 'has space', tier: 'pro' }, { privateKey, publicKey }),
    ).rejects.toThrow(/Invalid --slug/);

    await expect(
      issueRevForgeLicense({ slug: '', tier: 'pro' }, { privateKey, publicKey }),
    ).rejects.toThrow(/Invalid --slug/);
  });

  it('rejects invalid tier (including free, which has no commercial license)', async () => {
    await expect(
      issueRevForgeLicense(
        // biome-ignore lint/suspicious/noExplicitAny: invalid tier on purpose
        { slug: 'acme', tier: 'free' as any },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/Invalid --tier/);
  });

  it('rejects perpetual + expiresInDays combined', async () => {
    await expect(
      issueRevForgeLicense(
        { slug: 'acme', tier: 'pro', perpetual: true, expiresInDays: 30 },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/mutually exclusive/);
  });

  it('rejects non-positive expiresInDays', async () => {
    await expect(
      issueRevForgeLicense(
        { slug: 'acme', tier: 'pro', expiresInDays: 0 },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/positive integer/);

    await expect(
      issueRevForgeLicense(
        { slug: 'acme', tier: 'pro', expiresInDays: -1 },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/positive integer/);
  });

  it('rejects non-positive maxSites / maxUsers', async () => {
    await expect(
      issueRevForgeLicense(
        { slug: 'acme', tier: 'pro', maxSites: 0 },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/--max-sites/);

    await expect(
      issueRevForgeLicense(
        { slug: 'acme', tier: 'pro', maxUsers: -5 },
        { privateKey, publicKey },
      ),
    ).rejects.toThrow(/--max-users/);
  });

  it('omits optional fields from the payload when not provided', async () => {
    const result = await issueRevForgeLicense(
      { slug: 'minimal', tier: 'pro' },
      { privateKey, publicKey },
    );

    expect(result.payload).toEqual({ tier: 'pro', customerId: 'minimal' });
  });
});
