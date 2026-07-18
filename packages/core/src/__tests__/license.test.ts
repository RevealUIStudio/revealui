/**
 * License module tests  -  validates key generation, JWT verification,
 * tier checking, limits enforcement, perpetual licenses, and expiration.
 *
 * Uses real Ed25519 key pair (generated in beforeAll) for authentic JWT operations.
 */

import { generateKeyPairSync } from 'node:crypto';
import { decodeProtectedHeader, importPKCS8, SignJWT } from 'jose';
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
  REFRESH_ACCEPT_DAYS,
  resetLicenseState,
  validateLicenseKey,
  validateLicenseKeyForRefresh,
} from '../license.js';

// ---------------------------------------------------------------------------
// Key pair generation (one-time, shared across all tests)
// ---------------------------------------------------------------------------

let publicKeyPem: string;
let privateKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
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
    const { privateKey: otherPrivPem } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_wrong' }, otherPrivPem);
    // Verify with the original public key — should fail
    const result = await validateLicenseKey(jwt, publicKeyPem);
    expect(result).toBeNull();
  });

  it('rejects an RS256-signed JWT (algorithm mismatch)', async () => {
    // Mint an RS256 JWT directly — simulates the pre-migration API issuer
    const rsaKeyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const rsaPrivKey = await importPKCS8(rsaKeyPair.privateKey, 'RS256');
    const rs256Jwt = await new SignJWT({ tier: 'pro', customerId: 'cus_legacy' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setIssuer('revealui-license-server')
      .setAudience('revealui-runtime')
      .setExpirationTime('1y')
      .sign(rsaPrivKey);
    // Ed25519 public key must reject an RS256 JWT
    const result = await validateLicenseKey(rs256Jwt, publicKeyPem);
    expect(result).toBeNull();
  });

  it('round-trips a rich payload signed with Ed25519', async () => {
    const jwt = await generateLicenseKey(
      {
        tier: 'enterprise',
        customerId: 'cus_rich',
        domains: ['app.acme.com', 'admin.acme.com'],
        maxSites: 50,
        maxUsers: 500,
        perpetual: false,
      },
      privateKeyPem,
      365 * 24 * 60 * 60,
      publicKeyPem,
    );
    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe('EdDSA');
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('enterprise');
    expect(payload?.customerId).toBe('cus_rich');
    expect(payload?.domains).toEqual(['app.acme.com', 'admin.acme.com']);
    expect(payload?.maxSites).toBe(50);
    expect(payload?.maxUsers).toBe(500);
    expect(payload?.perpetual).toBe(false);
  });

  it('returns null for malformed public key', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_bad' }, privateKeyPem);
    const result = await validateLicenseKey(jwt, 'not-a-pem-key');
    expect(result).toBeNull();
  });

  // ── Phase 1 audit B-2: customerId-binding + jti claim ─────────────────────

  it('B-2: token carries a jti claim (auto-generated when not supplied)', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_jti' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.jti).toBeDefined();
    expect(payload?.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('B-2: token carries a jti claim (caller-supplied when given)', async () => {
    const supplied = '00000000-0000-0000-0000-000000000001';
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_jti2', jti: supplied },
      privateKeyPem,
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.jti).toBe(supplied);
  });

  it('B-2: token carries a nbf claim (set to issuance time)', async () => {
    const before = Math.floor(Date.now() / 1000) - 1;
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_nbf' }, privateKeyPem);
    // Decode the jose payload directly to check nbf — validateLicenseKey
    // strips nbf from the typed payload but it's enforced at verify time.
    const parts = jwt.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    expect(decoded.nbf).toBeDefined();
    expect(decoded.nbf).toBeGreaterThanOrEqual(before);
  });

  it('B-2: customerId binding accepts when expectation matches', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_bind' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem, 'cus_bind');
    expect(payload).not.toBeNull();
    expect(payload?.customerId).toBe('cus_bind');
  });

  it('B-2: customerId binding rejects when expectation mismatches', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_a' }, privateKeyPem);
    // Same valid signature + iss + aud + exp, but expected customerId differs.
    const payload = await validateLicenseKey(jwt, publicKeyPem, 'cus_b');
    expect(payload).toBeNull();
  });

  it('B-2: customerId binding skipped when expectation is undefined (back-compat)', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_any' }, privateKeyPem);
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.customerId).toBe('cus_any');
  });

  it('B-2: customerId binding rejects empty string expectation as mismatch', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_x' }, privateKeyPem);
    // An empty-string env var coalesces to undefined at the call site
    // (env.X || undefined), so this case shouldn't actually reach the
    // mismatch branch. But if it does: reject — never accept a token
    // claiming a customer id that the deployment didn't authorize.
    const payload = await validateLicenseKey(jwt, publicKeyPem, '');
    expect(payload).toBeNull();
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

// =============================================================================
// validateLicenseKey — multi-key rotation (GAP-259 P0-3)
// =============================================================================

describe('validateLicenseKey — multi-key rotation (GAP-259 P0-3)', () => {
  let nextPublicKeyPem: string;
  let nextPrivateKeyPem: string;
  let otherPublicKeyPem: string;
  let otherPrivateKeyPem: string;

  beforeAll(() => {
    const next = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    nextPublicKeyPem = next.publicKey;
    nextPrivateKeyPem = next.privateKey;
    const other = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    otherPublicKeyPem = other.publicKey;
    otherPrivateKeyPem = other.privateKey;
  });

  afterEach(() => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  });

  it('verifies a token signed by the CURRENT key when both keys are offered', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_cur' },
      privateKeyPem,
      3600,
      publicKeyPem,
    );
    const payload = await validateLicenseKey(jwt, [publicKeyPem, nextPublicKeyPem]);
    expect(payload?.tier).toBe('pro');
    expect(payload?.customerId).toBe('cus_cur');
  });

  it('verifies a NEXT-kid-signed token against ordered [current, next] candidates', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'max', customerId: 'cus_next' },
      nextPrivateKeyPem,
      3600,
      nextPublicKeyPem,
    );
    // The token's kid is the NEXT key's fingerprint, not the current key's.
    expect(decodeProtectedHeader(jwt).kid).toBe(await computeKeyId(nextPublicKeyPem));

    const payload = await validateLicenseKey(jwt, [publicKeyPem, nextPublicKeyPem]);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('max');
    expect(payload?.customerId).toBe('cus_next');
  });

  it('rejects a token signed by a key in NEITHER slot', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_x' },
      otherPrivateKeyPem,
      3600,
      otherPublicKeyPem,
    );
    expect(await validateLicenseKey(jwt, [publicKeyPem, nextPublicKeyPem])).toBeNull();
  });

  it('verifies a token that carries no kid against whichever offered key signed it', async () => {
    // No publicKey arg → generateLicenseKey omits the kid header.
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_nokid' },
      nextPrivateKeyPem,
    );
    expect(decodeProtectedHeader(jwt).kid).toBeUndefined();
    const payload = await validateLicenseKey(jwt, [publicKeyPem, nextPublicKeyPem]);
    expect(payload?.customerId).toBe('cus_nokid');
  });

  it('keeps single-string behavior unchanged (backward compatible)', async () => {
    const own = await generateLicenseKey({ tier: 'pro', customerId: 'cus_single' }, privateKeyPem);
    expect(await validateLicenseKey(own, publicKeyPem)).not.toBeNull();
    const foreign = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_f' },
      nextPrivateKeyPem,
    );
    expect(await validateLicenseKey(foreign, publicKeyPem)).toBeNull();
  });

  it('returns null for an empty candidate list', async () => {
    const jwt = await generateLicenseKey({ tier: 'pro', customerId: 'cus_empty' }, privateKeyPem);
    expect(await validateLicenseKey(jwt, [])).toBeNull();
  });

  it('initializeLicense verifies a NEXT-signed token via REVEALUI_LICENSE_PUBLIC_KEY_NEXT', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'max', customerId: 'cus_rotate' },
      nextPrivateKeyPem,
      3600,
      nextPublicKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem; // current, did NOT sign
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = nextPublicKeyPem; // incoming, DID sign
    expect(await initializeLicense()).toBe('max');
    expect(getCurrentTier()).toBe('max');
  });

  it('normalizes a single-line NEXT key with literal newline escapes (Docker/.env form)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_nl' },
      nextPrivateKeyPem,
      3600,
      nextPublicKeyPem,
    );
    process.env.REVEALUI_LICENSE_KEY = jwt;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    // Collapse real newlines to the literal two-character escape sequence.
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = nextPublicKeyPem.split('\n').join('\\n');
    expect(await initializeLicense()).toBe('pro');
  });
});

// =============================================================================
// validateLicenseKeyForRefresh (GAP-287 PR-1)
// =============================================================================

describe('validateLicenseKeyForRefresh', () => {
  const ISSUER = 'https://revealui.com';
  const AUDIENCE = 'revealui-license';

  /** Mint a token with an explicit absolute exp (epoch seconds). */
  async function mintToken(opts: {
    privateKey: string;
    publicKey?: string;
    expSec: number;
    customerId?: string;
  }): Promise<string> {
    const key = await importPKCS8(opts.privateKey, 'EdDSA');
    const header: { alg: string; kid?: string } = { alg: 'EdDSA' };
    if (opts.publicKey) {
      header.kid = await computeKeyId(opts.publicKey);
    }
    return new SignJWT({
      tier: 'pro',
      customerId: opts.customerId ?? 'cus_123',
      jti: 'jti-refresh-test',
    })
      .setProtectedHeader(header)
      .setIssuedAt()
      .setNotBefore('0s')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(opts.expSec)
      .sign(key);
  }

  const nowSec = () => Math.floor(Date.now() / 1000);

  it('ratifies the refresh-accept window at 30 days', () => {
    expect(REFRESH_ACCEPT_DAYS).toBe(30);
  });

  it('accepts a live (unexpired) key and returns its payload', async () => {
    const token = await mintToken({ privateKey: privateKeyPem, expSec: nowSec() + 86_400 });
    const payload = await validateLicenseKeyForRefresh(token, publicKeyPem);
    expect(payload?.customerId).toBe('cus_123');
    expect(payload?.tier).toBe('pro');
  });

  it('accepts a key expired WITHIN the refresh-accept window', async () => {
    // Expired 20 days ago — inside the 30-day window.
    const token = await mintToken({
      privateKey: privateKeyPem,
      expSec: nowSec() - 20 * 86_400,
    });
    const payload = await validateLicenseKeyForRefresh(token, publicKeyPem);
    expect(payload?.customerId).toBe('cus_123');
  });

  it('rejects a key expired BEYOND the refresh-accept window', async () => {
    // Expired 40 days ago — outside the 30-day window.
    const token = await mintToken({
      privateKey: privateKeyPem,
      expSec: nowSec() - 40 * 86_400,
    });
    const payload = await validateLicenseKeyForRefresh(token, publicKeyPem);
    expect(payload).toBeNull();
  });

  it('honors an explicit refreshAcceptDays override', async () => {
    const token = await mintToken({
      privateKey: privateKeyPem,
      expSec: nowSec() - 10 * 86_400,
    });
    // A 5-day window rejects a token expired 10 days ago.
    expect(await validateLicenseKeyForRefresh(token, publicKeyPem, 5)).toBeNull();
    // A 15-day window accepts the same token.
    expect((await validateLicenseKeyForRefresh(token, publicKeyPem, 15))?.customerId).toBe(
      'cus_123',
    );
  });

  it('refreshes a token signed by the OUTGOING key during a dual-key rotation window', async () => {
    // GAP-259 composition: mint under an old keypair, verify against the ordered
    // [current, next] set (the outgoing key is one of the candidates).
    const { publicKey: oldPub, privateKey: oldPriv } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const token = await mintToken({
      privateKey: oldPriv,
      publicKey: oldPub,
      expSec: nowSec() - 5 * 86_400, // recently expired, within window
    });
    // Ordered set: current (the module keypair) first, outgoing (old) second.
    const payload = await validateLicenseKeyForRefresh(token, [publicKeyPem, oldPub]);
    expect(payload?.customerId).toBe('cus_123');
  });

  it('rejects a token signed by an unrelated key', async () => {
    const { privateKey: strayPriv } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const token = await mintToken({ privateKey: strayPriv, expSec: nowSec() + 86_400 });
    expect(await validateLicenseKeyForRefresh(token, publicKeyPem)).toBeNull();
  });

  it('returns null when no candidate keys are supplied', async () => {
    const token = await mintToken({ privateKey: privateKeyPem, expSec: nowSec() + 86_400 });
    expect(await validateLicenseKeyForRefresh(token, [])).toBeNull();
  });
});
