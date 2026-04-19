/**
 * License module tests  -  validates key generation, JWT verification,
 * tier checking, limits enforcement, perpetual licenses, and expiration.
 *
 * Uses real RSA key pair (generated in beforeAll) for authentic JWT operations.
 */

import { decodeProtectedHeader } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  computeKeyId,
  configureGracePeriods,
  generateLicenseKey,
  getCurrentTier,
  getLicensePayload,
  getLicenseStatus,
  getMaxAgentTasks,
  getMaxSites,
  getMaxUsers,
  initializeLicense,
  isLicensed,
  type LicenseTier,
  MAX_LICENSE_CACHE_TTL_MS,
  parseLicenseCacheTtlEnv,
  resetLicenseState,
  validateLicenseKey,
} from '../license.js';

// ---------------------------------------------------------------------------
// Key pair generation (one-time, shared across all tests)
// ---------------------------------------------------------------------------

let publicKeyPem: string;
let privateKeyPem: string;

beforeAll(async () => {
  // Generate a real RSA key pair for testing
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const pubDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(pubDer).toString('base64')}\n-----END PUBLIC KEY-----`;
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privDer).toString('base64')}\n-----END PRIVATE KEY-----`;
});

afterEach(() => {
  resetLicenseState();
  configureGracePeriods({ subscriptionDays: 3, perpetualDays: 30, infraDays: 7 });
  delete process.env.REVEALUI_LICENSE_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
});

// =============================================================================
// generateLicenseKey
// =============================================================================

describe('generateLicenseKey', () => {
  it('generates a valid JWT string', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_123' }, privateKeyPem);
    expect(jwt).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('generated key is verifiable with the public key', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_123' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('pro');
    expect(payload?.customerId).toBe('cus_123');
  });

  it('includes maxSites and maxUsers when specified', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'max', customerId: 'cus_456', maxSites: 15, maxUsers: 100 },
      privateKeyPem,
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.maxSites).toBe(15);
    expect(payload?.maxUsers).toBe(100);
  });

  it('includes domains when specified', async () => {
    const jwt = await generateLicenseKey(
      {
        tier: 'enterprise',
        customerId: 'cus_ent',
        domains: ['app.example.com', 'admin.example.com'],
      },
      privateKeyPem,
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.domains).toEqual(['app.example.com', 'admin.example.com']);
  });

  it('sets expiration by default (1 year)', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_123' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.exp).toBeDefined();
    // exp should be roughly 1 year from now (within 10 seconds tolerance)
    const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    expect(payload!.exp!).toBeGreaterThan(oneYearFromNow - 10);
    expect(payload!.exp!).toBeLessThan(oneYearFromNow + 10);
  });

  it('omits exp for perpetual licenses (expiresInSeconds=null)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_perp', perpetual: true },
      privateKeyPem,
      null,
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.perpetual).toBe(true);
    expect(payload?.exp).toBeUndefined();
  });

  it('sets custom expiration', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_custom' },
      privateKeyPem,
      3600, // 1 hour
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600;
    expect(payload!.exp!).toBeGreaterThan(oneHourFromNow - 10);
    expect(payload!.exp!).toBeLessThan(oneHourFromNow + 10);
  });

  it('sets iat claim', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_iat' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.iat).toBeDefined();
    const now = Math.floor(Date.now() / 1000);
    expect(payload!.iat!).toBeGreaterThan(now - 10);
    expect(payload!.iat!).toBeLessThanOrEqual(now + 1);
  });
});

// =============================================================================
// validateLicenseKey
// =============================================================================

describe('validateLicenseKey', () => {
  it('returns null for garbage input', async () => {
    const result = await validateLicenseKey('not-a-jwt', publicKeyPem);
    expect(result).toBeNull();
  });

  it('returns null for key expired beyond grace period', async () => {
    // Generate a key that expired 10 days ago (beyond 3-day grace)
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_exp' },
      privateKeyPem,
      -(10 * 86_400), // expired 10 days ago
    );
    const result = await validateLicenseKey(jwt, publicKeyPem);
    expect(result).toBeNull();
  });

  it('returns payload for recently expired key (within grace)', async () => {
    // Generate a key that expired 1 day ago (within 3-day grace)
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_grace_jwt' },
      privateKeyPem,
      -86_400, // expired 1 day ago
    );
    const result = await validateLicenseKey(jwt, publicKeyPem);
    // Payload should be returned — grace period logic in isLicensed() handles the mode
    expect(result).not.toBeNull();
    expect(result?.tier).toBe('pro');
  });

  it('returns null for key signed with different private key', async () => {
    // Generate a different key pair
    const otherKeyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const otherPrivDer = await crypto.subtle.exportKey('pkcs8', otherKeyPair.privateKey);
    const otherPrivPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(otherPrivDer).toString('base64')}\n-----END PRIVATE KEY-----`;

    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_wrong' }, otherPrivPem);
    // Verify with the original public key  -  should fail
    const result = await validateLicenseKey(jwt, publicKeyPem);
    expect(result).toBeNull();
  });

  it('returns null for malformed public key', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_bad' }, privateKeyPem);
    const result = await validateLicenseKey(jwt, 'not-a-pem-key');
    expect(result).toBeNull();
  });
});

// =============================================================================
// initializeLicense
// =============================================================================

describe('initializeLicense', () => {
  it('returns free when no env vars are set', async () => {
    const tier = await initializeLicense();
    expect(tier).toBe('free');
    expect(getCurrentTier()).toBe('free');
  });

  it('returns free when only license key is set (no public key)', async () => {
    process.env.REVEALUI_LICENSE_KEY = 'some.jwt.key';
    const tier = await initializeLicense();
    expect(tier).toBe('free');
  });

  it('returns free when license key is invalid', async () => {
    process.env.REVEALUI_LICENSE_KEY = 'invalid.jwt';
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    const tier = await initializeLicense();
    expect(tier).toBe('free');
  });

  it('returns correct tier for valid key', async () => {
    const jwt = await generateLicenseKey({ tier: 'max', customerId: 'cus_max' }, privateKeyPem);
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;

    const tier = await initializeLicense();
    expect(tier).toBe('max');
    expect(getCurrentTier()).toBe('max');
    expect(getLicensePayload()?.customerId).toBe('cus_max');
  });
});

// =============================================================================
// isLicensed  -  tier comparison + expiration
// =============================================================================

describe('isLicensed', () => {
  it('free tier is always available', () => {
    expect(isLicensed('free')).toBe(true);
  });

  it('returns false for pro when on free tier', () => {
    expect(isLicensed('pro')).toBe(false);
  });

  it('returns true for pro when on max tier', async () => {
    const jwt = await generateLicenseKey({ tier: 'max', customerId: 'cus_max' }, privateKeyPem);
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(isLicensed('pro')).toBe(true);
    expect(isLicensed('max')).toBe(true);
    expect(isLicensed('enterprise')).toBe(false);
  });

  it('returns true for enterprise tier (highest)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'cus_ent' },
      privateKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(isLicensed('pro')).toBe(true);
    expect(isLicensed('max')).toBe(true);
    expect(isLicensed('enterprise')).toBe(true);
  });

  it('perpetual licenses never expire', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_perp', perpetual: true },
      privateKeyPem,
      null,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(isLicensed('pro')).toBe(true);
  });
});

// =============================================================================
// Tier-specific limits
// =============================================================================

describe('getMaxSites', () => {
  const tiers: Array<{ tier: LicenseTier; expected: number }> = [
    { tier: 'pro', expected: 5 },
    { tier: 'max', expected: 15 },
    { tier: 'enterprise', expected: Infinity },
  ];

  it('returns 1 for free tier', () => {
    expect(getMaxSites()).toBe(1);
  });

  for (const { tier, expected } of tiers) {
    it(`returns ${expected} for ${tier} tier`, async () => {
      const jwt = await generateLicenseKey({ tier, customerId: `cus_${tier}` }, privateKeyPem);
      process.env.REVEALUI_LICENSE_KEY = jwt;
      process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
      await initializeLicense();

      expect(getMaxSites()).toBe(expected);
    });
  }

  it('uses custom maxSites from payload when present', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_custom', maxSites: 10 },
      privateKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(getMaxSites()).toBe(10);
  });
});

describe('getMaxUsers', () => {
  it('returns 3 for free tier', () => {
    expect(getMaxUsers()).toBe(3);
  });

  it('returns 25 for pro tier (default)', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_pro' }, privateKeyPem);
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(getMaxUsers()).toBe(25);
  });

  it('returns custom maxUsers when set', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_custom', maxUsers: 50 },
      privateKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(getMaxUsers()).toBe(50);
  });

  it('returns Infinity for enterprise', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'cus_ent' },
      privateKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(getMaxUsers()).toBe(Infinity);
  });
});

describe('getMaxAgentTasks', () => {
  const tiers: Array<{ tier: LicenseTier; expected: number }> = [
    { tier: 'pro', expected: 10_000 },
    { tier: 'max', expected: 50_000 },
    { tier: 'enterprise', expected: Infinity },
  ];

  it('returns 1000 for free tier', () => {
    expect(getMaxAgentTasks()).toBe(1_000);
  });

  for (const { tier, expected } of tiers) {
    it(`returns ${expected} for ${tier} tier`, async () => {
      const jwt = await generateLicenseKey({ tier, customerId: `cus_${tier}` }, privateKeyPem);
      process.env.REVEALUI_LICENSE_KEY = jwt;
      process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
      await initializeLicense();

      expect(getMaxAgentTasks()).toBe(expected);
    });
  }
});

// =============================================================================
// computeKeyId
// =============================================================================

describe('computeKeyId', () => {
  it('returns an 8-character hex string', async () => {
    const kid = await computeKeyId(publicKeyPem);
    expect(kid).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns consistent results for the same key', async () => {
    const kid1 = await computeKeyId(publicKeyPem);
    const kid2 = await computeKeyId(publicKeyPem);
    expect(kid1).toBe(kid2);
  });

  it('returns different results for different keys', async () => {
    const otherKeyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const otherPubDer = await crypto.subtle.exportKey('spki', otherKeyPair.publicKey);
    const otherPubPem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(otherPubDer).toString('base64')}\n-----END PUBLIC KEY-----`;

    expect(await computeKeyId(publicKeyPem)).not.toBe(await computeKeyId(otherPubPem));
  });
});

// =============================================================================
// JWT kid header claim
// =============================================================================

describe('JWT kid header claim', () => {
  it('includes kid in protected header when publicKey is provided', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_kid' },
      privateKeyPem,
      365 * 24 * 60 * 60,
      publicKeyPem,
    );
    const header = await decodeProtectedHeader(jwt);
    expect(header.kid).toBe(await computeKeyId(publicKeyPem));
  });

  it('omits kid when publicKey is not provided', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_nokid' }, privateKeyPem);
    const header = await decodeProtectedHeader(jwt);
    expect(header.kid).toBeUndefined();
  });

  it('verification still works with kid in header', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'max', customerId: 'cus_verify_kid' },
      privateKeyPem,
      365 * 24 * 60 * 60,
      publicKeyPem,
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('max');
    expect(payload?.customerId).toBe('cus_verify_kid');
  });

  it('verification still works without kid in header (backward compat)', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_no_kid' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('pro');
  });
});

// =============================================================================
// resetLicenseState
// =============================================================================

describe('resetLicenseState', () => {
  it('resets to free tier', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'cus_ent' },
      privateKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(getCurrentTier()).toBe('enterprise');
    resetLicenseState();
    expect(getCurrentTier()).toBe('free');
    expect(getLicensePayload()).toBeNull();
  });
});

// =============================================================================
// Grace periods  -  subscription expiry
// =============================================================================

describe('subscription grace period', () => {
  it('allows access during 3-day grace after subscription expiry', async () => {
    // Generate a key that expired 1 day ago
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_grace' },
      privateKeyPem,
      -86_400, // expired 1 day ago
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    // isLicensed should still return true (within 3-day grace)
    expect(isLicensed('pro')).toBe(true);
  });

  it('denies access after grace period exhausted', async () => {
    // Set grace to 1 day — key expired 2 days ago is beyond grace
    configureGracePeriods({ subscriptionDays: 1 });

    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_no_grace' },
      privateKeyPem,
      -(2 * 86_400), // expired 2 days ago, beyond 1-day grace
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(isLicensed('pro')).toBe(false);
  });

  it('respects custom grace period configuration', async () => {
    // Set grace to 10 days
    configureGracePeriods({ subscriptionDays: 10 });

    // Expired 7 days ago — within 10-day grace
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_custom_grace' },
      privateKeyPem,
      -(7 * 86_400),
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    expect(isLicensed('pro')).toBe(true);
  });

  it('perpetual licenses are unaffected by subscription grace', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_perp_grace', perpetual: true },
      privateKeyPem,
      null,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    // Perpetual licenses skip exp check entirely — always valid
    expect(isLicensed('pro')).toBe(true);
  });
});

// =============================================================================
// getLicenseStatus  -  rich status reporting
// =============================================================================

describe('getLicenseStatus', () => {
  it('returns mode=missing when no license configured', () => {
    const status = getLicenseStatus();
    expect(status.mode).toBe('missing');
    expect(status.tier).toBe('free');
    expect(status.allowed).toBe(false);
    expect(status.readOnly).toBe(false);
  });

  it('returns mode=missing but allowed for free tier check', () => {
    const status = getLicenseStatus('free');
    expect(status.mode).toBe('missing');
    expect(status.allowed).toBe(true);
  });

  it('returns mode=active for valid license', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_active' }, privateKeyPem);
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    const status = getLicenseStatus('pro');
    expect(status.mode).toBe('active');
    expect(status.tier).toBe('pro');
    expect(status.allowed).toBe(true);
    expect(status.readOnly).toBe(false);
    expect(status.graceRemainingMs).toBeUndefined();
  });

  it('returns mode=grace for recently expired subscription', async () => {
    // Expired 1 day ago, within 3-day grace
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_grace_status' },
      privateKeyPem,
      -86_400,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    const status = getLicenseStatus('pro');
    expect(status.mode).toBe('grace');
    expect(status.tier).toBe('pro');
    expect(status.allowed).toBe(true);
    expect(status.readOnly).toBe(false);
    expect(status.graceRemainingMs).toBeGreaterThan(0);
    expect(status.reason).toContain('grace remaining');
  });

  it('returns mode=expired when grace exhausted', async () => {
    // 1-day grace, expired 2 days ago — beyond grace
    configureGracePeriods({ subscriptionDays: 1 });

    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_expired_status' },
      privateKeyPem,
      -(2 * 86_400),
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    const status = getLicenseStatus('pro');
    expect(status.mode).toBe('expired');
    expect(status.tier).toBe('free');
    expect(status.allowed).toBe(false);
    expect(status.readOnly).toBe(false);
  });

  it('returns allowed=false when requesting higher tier than licensed', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_low' }, privateKeyPem);
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    await initializeLicense();

    const status = getLicenseStatus('enterprise');
    expect(status.mode).toBe('active');
    expect(status.allowed).toBe(false);
  });
});

// =============================================================================
// parseLicenseCacheTtlEnv  -  LICENSE_CACHE_TTL_MS env parsing + cap (CR8-P1-05)
// =============================================================================

describe('parseLicenseCacheTtlEnv', () => {
  const DEFAULT_TTL_MS = 15_000;

  it('returns default when env is undefined', () => {
    expect(parseLicenseCacheTtlEnv(undefined)).toBe(DEFAULT_TTL_MS);
  });

  it('returns default when env is empty string', () => {
    expect(parseLicenseCacheTtlEnv('')).toBe(DEFAULT_TTL_MS);
  });

  it('returns default when env is non-numeric', () => {
    expect(parseLicenseCacheTtlEnv('abc')).toBe(DEFAULT_TTL_MS);
  });

  it('returns default when env is zero', () => {
    expect(parseLicenseCacheTtlEnv('0')).toBe(DEFAULT_TTL_MS);
  });

  it('returns default when env is negative', () => {
    expect(parseLicenseCacheTtlEnv('-1')).toBe(DEFAULT_TTL_MS);
  });

  it('returns parsed value when within cap', () => {
    expect(parseLicenseCacheTtlEnv('30000')).toBe(30_000);
    expect(parseLicenseCacheTtlEnv('60000')).toBe(60_000);
  });

  it('accepts values up to the exact cap', () => {
    expect(parseLicenseCacheTtlEnv(String(MAX_LICENSE_CACHE_TTL_MS))).toBe(
      MAX_LICENSE_CACHE_TTL_MS,
    );
  });

  it('clamps values above cap and emits a console warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(parseLicenseCacheTtlEnv(String(sevenDaysMs))).toBe(MAX_LICENSE_CACHE_TTL_MS);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('exceeds');
      expect(warnSpy.mock.calls[0][0]).toContain('cap');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('cap is 15 minutes (900_000 ms)', () => {
    expect(MAX_LICENSE_CACHE_TTL_MS).toBe(15 * 60 * 1000);
    expect(MAX_LICENSE_CACHE_TTL_MS).toBe(900_000);
  });
});
