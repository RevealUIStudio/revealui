import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @revealui/core/features and @revealui/core/license
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn((tier: string) => ({
    ai: tier !== 'free',
    collaboration: tier !== 'free',
    analytics: tier === 'enterprise',
  })),
}));

vi.mock('@revealui/core/license', () => {
  // Mirror production normalizePem / readPemEnv / getPublicKeys (literal \n → real newline).
  // After #2017 the license routes call readPemEnv; a passthrough mock made
  // the PEM-unescape tests fail while production was still correct.
  // getPublicKeys mirrors packages/core license rotation (current + NEXT).
  const normalizePem = (raw: string) => raw.split('\\n').join('\n');
  const readPemEnv = (name: string, env: NodeJS.ProcessEnv = process.env) => {
    const raw = env[name];
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return undefined;
    return normalizePem(trimmed);
  };
  const getPublicKeys = () => {
    const keys: string[] = [];
    const current = process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    if (current) keys.push(normalizePem(current));
    const next = process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    if (next) keys.push(normalizePem(next));
    return keys;
  };
  return {
    normalizePem,
    readPemEnv,
    getPublicKeys,
    getLicensePublicKeyTrustManifest: vi.fn(),
    validateLicenseKeyAgainstTrustManifest: vi.fn(),
    coversRenewalBound: vi.fn(() => false),
    DEFAULT_MANUAL_MINT_DAYS: 90,
    validateLicenseKey: vi.fn(),
    validateLicenseKeyForOperator: vi.fn(),
    generateLicenseKey: vi.fn(),
    readLicenseJti: vi.fn(async () => null),
  };
});

vi.mock('@revealui/core/license/mint-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@revealui/core/license/mint-client')>()),
  // Mirror local canMintLicense: private key presence (default path; flag off).
  canMintLicense: vi.fn(() => Boolean(process.env.REVEALUI_LICENSE_PRIVATE_KEY?.trim())),
  mintConfigMissingMessage: vi.fn(() => 'REVEALUI_LICENSE_PRIVATE_KEY not configured'),
  mintLicenseKey: vi.fn().mockResolvedValue('generated.key'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock DB to prevent real connection attempts during tests
vi.mock('@revealui/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@revealui/db')>()),
  findLicenseOperation: vi.fn(async () => null),
  applyLicenseOperation: vi.fn(async (_db, input) => ({
    licenseKey: input.licenseKey,
    operation: input.descriptor ?? null,
  })),
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  })),
  isJtiRevoked: vi.fn(async () => false),
}));

vi.mock('@revealui/db/schema', () => ({
  licenses: {
    status: 'status',
    licenseKey: 'license_key',
  },
  accountMemberships: {
    accountId: 'account_id',
    userId: 'user_id',
    status: 'status',
  },
}));

vi.mock('../../lib/nudges/milestone-meters.js', () => ({
  recordMilestoneMeterFirstSafe: vi.fn(),
  LICENSE_KEY_FETCHED_METER_NAME: 'license_key_fetched',
}));

import {
  getLicensePublicKeyTrustManifest,
  validateLicenseKey,
  validateLicenseKeyAgainstTrustManifest,
} from '@revealui/core/license';
import { mintLicenseKey } from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import { applyLicenseOperation, findLicenseOperation, getClient, isJtiRevoked } from '@revealui/db';
import licenseApp from '../license.js';

const mockedValidate = vi.mocked(validateLicenseKey);
const mockedTrustManifest = vi.mocked(getLicensePublicKeyTrustManifest);
const mockedManifestVerify = vi.mocked(validateLicenseKeyAgainstTrustManifest);
const mockedGenerate = vi.mocked(mintLicenseKey);

function createApp() {
  const app = new Hono();
  app.route('/', licenseApp);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function post(_path: string, body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    body: JSON.stringify(
      _path === '/generate'
        ? { operationId: '12345678-1234-4123-8123-123456789012', ...(body as object) }
        : body,
    ),
    headers: { 'Content-Type': 'application/json', ...headers },
  };
}

// ---------------------------------------------------------------------------

describe('POST /verify', () => {
  const trustManifest = {
    version: 1 as const,
    issuer: 'https://revealui.com' as const,
    audience: 'revealui-license' as const,
    keys: [
      {
        role: 'current' as const,
        algorithm: 'EdDSA' as const,
        publicKey: 'pub-key',
        jwtKid: '12345678',
        keyId: 'a'.repeat(64),
      },
    ],
    digest: 'b'.repeat(64),
    publicKey: 'pub-key',
  };

  beforeEach(() => {
    mockedTrustManifest.mockClear();
    mockedTrustManifest.mockResolvedValue(trustManifest);
    mockedManifestVerify.mockImplementation(async (token, manifest) => {
      const payload = await mockedValidate(
        token,
        manifest.keys.map((key) => key.publicKey),
      );
      return payload
        ? {
            payload,
            verifiedKeyId: manifest.keys[0]!.keyId,
            trustSetDigest: manifest.digest,
          }
        : null;
    });
  });

  it('returns valid:true for a good key', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_123',
      maxSites: 5,
      maxUsers: 25,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok.en.value' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(true);
    expect(body.tier).toBe('pro');
    expect(body.customerId).toBe('cus_123');
  });

  it('denies a signed but unregistered credential when online registration is required', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'customer',
      jti: 'registered-jti',
    } as never);
    const response = await createApp().request(
      '/verify',
      post('/verify', { licenseKey: 'signed.token', requireRegistration: true }),
    );
    expect(await response.json()).toMatchObject({
      valid: false,
      tier: 'free',
      reason: 'migration_required',
    });
  });

  it('binds a strict registration success to the exact manifest and signing key', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'customer',
      jti: 'registered-jti',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);
    vi.mocked(getClient).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                status: 'active',
                customerId: 'customer',
                tier: 'pro',
                deletedAt: null,
                perpetual: false,
                userId: null,
              },
            ],
          }),
        }),
      }),
    } as never);

    const response = await createApp().request(
      '/verify',
      post('/verify', { licenseKey: 'registered.token', requireRegistration: true }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      licenseKeyDigest: expect.any(String),
      trustSetDigest: trustManifest.digest,
      verifiedKeyId: trustManifest.keys[0]!.keyId,
    });
    expect(mockedTrustManifest).toHaveBeenCalledTimes(2);
  });

  it('denies strict success if the trust set changes during database verification', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'public';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'customer',
      jti: 'registered-jti',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);
    vi.mocked(getClient).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                status: 'active',
                customerId: 'customer',
                tier: 'pro',
                deletedAt: null,
                perpetual: false,
                userId: null,
              },
            ],
          }),
        }),
      }),
    } as never);
    mockedTrustManifest
      .mockResolvedValueOnce(trustManifest)
      .mockResolvedValueOnce({ ...trustManifest, digest: 'c'.repeat(64) });

    const response = await createApp().request(
      '/verify',
      post('/verify', { licenseKey: 'registered.token', requireRegistration: true }),
    );
    expect(await response.json()).toMatchObject({
      valid: false,
      reason: 'unverifiable',
      tier: 'free',
    });
  });

  it('denies if configuration changes while the final manifest is being rebuilt', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'customer',
      jti: 'registered-jti',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);
    vi.mocked(getClient).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                status: 'active',
                customerId: 'customer',
                tier: 'pro',
                deletedAt: null,
                perpetual: false,
                userId: null,
              },
            ],
          }),
        }),
      }),
    } as never);
    mockedTrustManifest
      .mockImplementationOnce(async () => trustManifest)
      .mockImplementationOnce(async () => {
        const manifestFromEarlierConfiguration = trustManifest;
        process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'rotated-during-manifest-build';
        return manifestFromEarlierConfiguration;
      });

    const response = await createApp().request(
      '/verify',
      post('/verify', { licenseKey: 'registered.token', requireRegistration: true }),
    );
    expect(await response.json()).toMatchObject({
      valid: false,
      reason: 'unverifiable',
      tier: 'free',
    });
  });
  it('fails closed without logging a driver error containing the bound token', async () => {
    const token = 'synthetic.bound.jwt-must-not-be-logged';
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'public';
    mockedValidate.mockResolvedValue({ tier: 'pro', customerId: 'customer', jti: 'j' } as never);
    vi.mocked(getClient)
      .mockReturnValueOnce({} as never)
      .mockReturnValueOnce({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => {
                throw new Error(`Failed query params: ${token}`);
              },
            }),
          }),
        }),
      } as never);
    const response = await createApp().request(
      '/verify',
      post('/verify', { licenseKey: token, requireRegistration: true }),
    );
    expect(await response.json()).toMatchObject({
      valid: false,
      reason: 'unverifiable',
      tier: 'free',
    });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(token);
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });
  it('returns valid:false for an invalid key', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue(null as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'bad.key' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.tier).toBe('free');
  });

  it('returns free tier when public key is not configured', async () => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'any.key' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.tier).toBe('free');

    // Restore
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
  });

  it('returns 400 for missing licenseKey', async () => {
    const app = createApp();
    const res = await app.request('/verify', post('/verify', {}));
    expect(res.status).toBe(400);
  });

  it('includes features object in response', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'enterprise',
      customerId: 'cus_ent',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }));
    const body = await parseBody(res);
    expect(typeof body.features).toBe('object');
  });

  it('returns null expiresAt when exp is missing', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({ tier: 'pro', customerId: 'cus_123' } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }));
    const body = await parseBody(res);
    expect(body.expiresAt).toBeNull();
  });

  it('returns expiresAt as ISO string when exp is present', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    const futureExp = Math.floor(Date.now() / 1000) + 86400;
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_123',
      exp: futureExp,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }));
    const body = await parseBody(res);
    expect(typeof body.expiresAt).toBe('string');
    expect(() => new Date(body.expiresAt)).not.toThrow();
    expect(new Date(body.expiresAt).getFullYear()).toBeGreaterThan(2020);
  });

  it('returns reason:misconfigured when public key is not configured', async () => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'any.key' }));
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('misconfigured');

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
  });

  it('returns default maxSites:5 and maxUsers:25 for pro tier', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_123',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }));
    const body = await parseBody(res);
    expect(body.maxSites).toBe(5);
    expect(body.maxUsers).toBe(25);
  });

  it('returns maxSites:null and maxUsers:null for enterprise tier', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockResolvedValue({
      tier: 'enterprise',
      customerId: 'cus_ent',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }));
    const body = await parseBody(res);
    expect(body.maxSites).toBeNull();
    expect(body.maxUsers).toBeNull();
  });
});

// GAP-261 soak: verify must accept current + NEXT during key rotation (same
// ordered list refresh already uses via getPublicKeys).
describe('POST /verify  -  multi-key rotation (current + NEXT)', () => {
  afterEach(() => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    mockedValidate.mockReset();
  });

  it('verifies a NEXT-signed token when PUBLIC and PUBLIC_NEXT are configured', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'current-pub';
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = 'next-pub';
    // Core validateLicenseKey accepts either candidate; mock success as if the
    // presented token was signed by NEXT and matched the second key.
    mockedValidate.mockImplementation(async (_key, publicKeys) => {
      const list = Array.isArray(publicKeys) ? publicKeys : [publicKeys];
      if (list.includes('next-pub')) {
        return {
          tier: 'pro',
          customerId: 'cus_rotate',
          maxSites: 5,
          maxUsers: 25,
          exp: Math.floor(Date.now() / 1000) + 86400,
        } as never;
      }
      return null as never;
    });

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'next.signed.token' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(true);
    expect(body.tier).toBe('pro');
    expect(body.customerId).toBe('cus_rotate');
    expect(mockedValidate).toHaveBeenCalledWith('next.signed.token', ['current-pub', 'next-pub']);
  });

  it('rejects a NEXT-signed token when only the current public key is set', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'current-pub';
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    mockedValidate.mockImplementation(async (_key, publicKeys) => {
      const list = Array.isArray(publicKeys) ? publicKeys : [publicKeys];
      if (list.includes('next-pub')) {
        return {
          tier: 'pro',
          customerId: 'cus_rotate',
          exp: Math.floor(Date.now() / 1000) + 86400,
        } as never;
      }
      return null as never;
    });

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'next.signed.token' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('invalid');
    expect(mockedValidate).toHaveBeenCalledWith('next.signed.token', ['current-pub']);
  });

  it('normalizes literal \\\\n in PUBLIC_NEXT before verify', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'BEGIN CURRENT\\nKEY\\nEND';
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = 'BEGIN NEXT\\nKEY\\nEND';
    mockedValidate.mockResolvedValue({
      tier: 'max',
      customerId: 'cus_nl',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    await app.request('/verify', post('/verify', { licenseKey: 'tok' }));

    expect(mockedValidate).toHaveBeenCalledWith('tok', [
      'BEGIN CURRENT\nKEY\nEND',
      'BEGIN NEXT\nKEY\nEND',
    ]);
  });
});

describe('POST /generate', () => {
  const ADMIN_KEY = 'secret-admin';
  beforeEach(() => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
    vi.mocked(findLicenseOperation).mockResolvedValue(null);
    vi.mocked(applyLicenseOperation).mockImplementation(async (_db, input) => ({
      licenseKey: input.licenseKey,
      operation: input.descriptor ?? null,
    }));
    mockedValidate.mockImplementation(async () => {
      const call = mockedGenerate.mock.calls.at(-1)?.[0];
      return {
        tier: call?.tier ?? 'pro',
        customerId: call?.customerId ?? 'cus',
        jti: 'synthetic-jti',
        perpetual: call?.perpetual === true,
        ...(call?.perpetual ? {} : { exp: Math.floor(Date.now() / 1000) + 86400 }),
      } as never;
    });
  });

  it('generates a license key with valid admin key', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key';
    mockedGenerate.mockResolvedValue('generated.license.token');

    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus_abc' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.licenseKey).toBe('generated.license.token');
    expect(body.tier).toBe('pro');
  });

  it('recovers committed result before signer access and rejects changed operation input', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    vi.mocked(findLicenseOperation).mockResolvedValue({
      licenseKey: 'committed.token',
      operation: null,
    });
    mockedGenerate.mockClear();
    const res = await createApp().request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'customer' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).licenseKey).toBe('committed.token');
    expect(mockedGenerate).not.toHaveBeenCalled();
    vi.mocked(findLicenseOperation).mockRejectedValue(new Error('synthetic conflict'));
    expect(
      (
        await createApp().request(
          '/generate',
          post(
            '/generate',
            { tier: 'max', customerId: 'customer' },
            { 'X-Admin-API-Key': ADMIN_KEY },
          ),
        )
      ).status,
    ).toBe(409);
  });
  it('does not acknowledge rollback and refuses perpetual duration ambiguity', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'private';
    vi.mocked(applyLicenseOperation).mockRejectedValue(new Error('synthetic rollback'));
    const res = await createApp().request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'customer' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(409);
    expect(await res.text()).not.toContain('generated');
    expect(
      (
        await createApp().request(
          '/generate',
          post(
            '/generate',
            { tier: 'pro', customerId: 'customer', perpetual: true, expiresInDays: 90 },
            { 'X-Admin-API-Key': ADMIN_KEY },
          ),
        )
      ).status,
    ).toBe(400);
  });
  it('returns 401 when admin key is missing', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.request('/generate', post('/generate', { tier: 'pro', customerId: 'c' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when admin key is wrong', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'c' }, { 'X-Admin-API-Key': 'wrong' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 503 when private key is not configured', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(503);

    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key';
  });

  it('returns 401 when admin key has different length (timing-safe branch)', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'c' }, { 'X-Admin-API-Key': 'short' }),
    );
    expect(res.status).toBe(401);
  });

  it('calls mintLicenseKey when private key is configured (PEM unescape lives in mint-client)', async () => {
    // GAP-260 P4-3: route delegates to mintLicenseKey; PEM normalize is covered
    // by packages/core license-mint-client + generateLicenseKey tests.
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    process.env.REVEALUI_LICENSE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\nMC4CAQA\\n-----END PRIVATE KEY-----';
    mockedGenerate.mockClear();
    mockedGenerate.mockResolvedValue('jwt.token');

    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus_unesc' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(201);
    expect(mockedGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'pro', customerId: 'cus_unesc' }),
    );
  });

  it('generates a max tier license', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key';
    mockedGenerate.mockResolvedValue('max.license.token');

    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'max', customerId: 'cus_max' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.tier).toBe('max');
  });

  it('returns 400 when customerId is missing', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /verify  -  DB revocation check (JWT is valid at JWT level, DB overrides)
// ---------------------------------------------------------------------------

describe('POST /verify  -  DB revocation override', () => {
  const VALID_PAYLOAD = {
    tier: 'pro' as const,
    customerId: 'cus_123',
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  function mockDb(rows: { status: string; supportExpiresAt?: Date | null; perpetual?: boolean }[]) {
    vi.mocked(getClient).mockReturnValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      }),
    } as never);
  }

  function mockDbThrow() {
    vi.mocked(getClient).mockReturnValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error('DB unavailable')),
          }),
        }),
      }),
    } as never);
  }

  beforeEach(() => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
  });

  it('returns valid:false reason:revoked when JWT is valid but DB row is revoked', async () => {
    mockedValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDb([{ status: 'revoked' }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'valid.jwt' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('revoked');
    expect(body.tier).toBe('free');
  });

  it('returns valid:false reason:revoked when JWT is valid but DB row is expired', async () => {
    mockedValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDb([{ status: 'expired' }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'valid.jwt' }));
    const body = await parseBody(res);
    // The route treats both 'revoked' and 'expired' DB status as dbRevoked=true → reason:'revoked'
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('revoked');
  });

  it('fails closed (valid:false, reason:unverifiable) when the DB revocation check throws', async () => {
    mockedValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbThrow();

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'valid.jwt' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    // A structurally-valid JWT whose revocation status could not be confirmed must
    // NOT be trusted: a revoked-but-unexpired token would otherwise report valid
    // for the duration of any DB outage. Fail closed to free tier.
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('unverifiable');
    expect(body.tier).toBe('free');
  });

  it('denies a JTI query outage even when the active license-row query would succeed', async () => {
    mockedValidate.mockResolvedValue({ ...VALID_PAYLOAD, jti: 'jti-outage' } as never);
    mockDb([{ status: 'active' }]);
    vi.mocked(isJtiRevoked).mockRejectedValueOnce(new Error('JTI authority unavailable'));

    const res = await createApp().request('/verify', post('/verify', { licenseKey: 'valid.jwt' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: false, reason: 'unverifiable', tier: 'free' });
  });

  it('returns reason:revoked when JWT is invalid and DB row is revoked', async () => {
    mockedValidate.mockResolvedValue(null as never);
    mockDb([{ status: 'revoked' }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'old.token' }));
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('revoked');
  });

  it('returns reason:expired when JWT is invalid and DB row is expired', async () => {
    mockedValidate.mockResolvedValue(null as never);
    mockDb([{ status: 'expired' }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'expired.token' }));
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('expired');
  });

  it('returns reason:invalid when JWT is invalid and not found in DB', async () => {
    mockedValidate.mockResolvedValue(null as never);
    // default mock returns []  -  no row found

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'unknown.token' }));
    const body = await parseBody(res);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('invalid');
  });

  // ── Perpetual support lapse ────────────────────────────────────────────────
  // A perpetual license is sold as permanent ownership. When the annual support
  // contract lapses, the purchased tier and its entitlements are frozen in place,
  // not revoked  -  only update delivery and support stop. Verifies the fix for
  // the downgrade-to-free-tier defect on this path.

  const PAST = new Date(Date.now() - 86_400_000);
  const FUTURE = new Date(Date.now() + 86_400_000);

  const PERPETUAL_PAYLOAD = {
    tier: 'enterprise' as const,
    customerId: 'cus_perp',
    perpetual: true,
    // Perpetual payloads carry no `exp`.
  };

  it('keeps tier features and limits when a perpetual license support contract has lapsed', async () => {
    mockedValidate.mockResolvedValue(PERPETUAL_PAYLOAD as never);
    mockDb([{ status: 'active', perpetual: true, supportExpiresAt: PAST }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'perpetual.jwt' }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);

    expect(body.valid).toBe(true);
    expect(body.reason).toBe('support_expired');
    expect(body.supportExpired).toBe(true);
    expect(body.supportExpiresAt).toBe(PAST.toISOString());

    // The purchased tier survives the lapse  -  this is the ownership promise.
    expect(body.tier).toBe('enterprise');
    expect(body.features.ai).toBe(true);
    expect(body.features.analytics).toBe(true);
    // Enterprise limits are unbounded, not the free tier's 1 site / 3 users.
    expect(body.maxSites).toBeNull();
    expect(body.maxUsers).toBeNull();
  });

  it('keeps tier features and limits when the DB row is already marked support_expired', async () => {
    // The nightly sweep marks lapsed perpetuals as status='support_expired'.
    mockedValidate.mockResolvedValue({
      tier: 'pro' as const,
      customerId: 'cus_perp',
      perpetual: true,
    } as never);
    mockDb([{ status: 'support_expired', perpetual: true, supportExpiresAt: PAST }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'perpetual.jwt' }));
    const body = await parseBody(res);

    expect(body.valid).toBe(true);
    expect(body.reason).toBe('support_expired');
    expect(body.supportExpired).toBe(true);
    expect(body.tier).toBe('pro');
    expect(body.features.ai).toBe(true);
    expect(body.features.collaboration).toBe(true);
    // Pro defaults, not the free tier's 1 / 3.
    expect(body.maxSites).toBe(5);
    expect(body.maxUsers).toBe(25);
  });

  it('reports a perpetual license with active support as valid, supportExpired:false', async () => {
    mockedValidate.mockResolvedValue(PERPETUAL_PAYLOAD as never);
    mockDb([{ status: 'active', perpetual: true, supportExpiresAt: FUTURE }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'perpetual.jwt' }));
    const body = await parseBody(res);

    expect(body.valid).toBe(true);
    expect(body.reason).toBe('valid');
    expect(body.supportExpired).toBe(false);
    expect(body.supportExpiresAt).toBe(FUTURE.toISOString());
    expect(body.tier).toBe('enterprise');
    // A perpetual license never expires.
    expect(body.expiresAt).toBeNull();
  });

  it('leaves subscription licenses unaffected by the support-lapse path', async () => {
    // VALID_PAYLOAD is a non-perpetual pro subscription with a future exp.
    mockedValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDb([{ status: 'active' }]);

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'subscription.jwt' }));
    const body = await parseBody(res);

    expect(body.valid).toBe(true);
    expect(body.reason).toBe('valid');
    expect(body.supportExpired).toBe(false);
    // No support contract is read for a non-perpetual license.
    expect(body.supportExpiresAt).toBeNull();
    expect(body.tier).toBe('pro');
    expect(body.expiresAt).toBe(new Date(VALID_PAYLOAD.exp * 1000).toISOString());
  });
});

describe('GET /features', () => {
  it('returns features for all three tiers', async () => {
    const app = createApp();
    const res = await app.request('/features');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(typeof body.free).toBe('object');
    expect(typeof body.pro).toBe('object');
    expect(typeof body.enterprise).toBe('object');
  });

  it('free tier has ai:false, pro tier has ai:true, enterprise has analytics:true', async () => {
    const app = createApp();
    const res = await app.request('/features');
    const body = await parseBody(res);
    // Validated against the getFeaturesForTier mock: ai=tier!=='free', analytics=tier==='enterprise'
    expect(body.free.ai).toBe(false);
    expect(body.pro.ai).toBe(true);
    expect(body.enterprise.analytics).toBe(true);
  });
});

describe('GET /public-key', () => {
  const ORIGINAL = process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  const ORIGINAL_NEXT = process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;

  beforeEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    } else {
      process.env.REVEALUI_LICENSE_PUBLIC_KEY = ORIGINAL;
    }
    if (ORIGINAL_NEXT === undefined) delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    else process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = ORIGINAL_NEXT;
  });

  it('returns the versioned ordered trust set with no-store caching', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY =
      '-----BEGIN PUBLIC KEY-----\\nMCowBQYDK2VwAyEA0000000000000000000000000000\\n-----END PUBLIC KEY-----';
    const publicKey = process.env.REVEALUI_LICENSE_PUBLIC_KEY.split('\\n').join('\n');
    const manifest = {
      version: 1,
      issuer: 'https://revealui.com',
      audience: 'revealui-license',
      keys: [
        {
          role: 'current',
          algorithm: 'EdDSA',
          publicKey,
          jwtKid: '12345678',
          keyId: 'a'.repeat(64),
        },
      ],
      digest: 'b'.repeat(64),
      publicKey,
    } as const;
    mockedTrustManifest.mockResolvedValueOnce(manifest);
    const app = createApp();
    const res = await app.request('/public-key');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body).toEqual(manifest);
    expect(body.keys[0].role).toBe('current');
    expect(body.keys[0].algorithm).toBe('EdDSA');
    expect(body.keys[0].jwtKid).toBe('12345678');
    expect(body.keys[0].keyId).toBe('a'.repeat(64));
    expect(body.publicKey).toBe(publicKey);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('serves a manifest produced by the real core trust constructor', async () => {
    const publicKey =
      '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=\n-----END PUBLIC KEY-----';
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKey;
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    const realCore =
      await vi.importActual<typeof import('@revealui/core/license')>('@revealui/core/license');
    mockedTrustManifest.mockImplementationOnce(() => realCore.getLicensePublicKeyTrustManifest());

    const res = await createApp().request('/public-key');
    expect(res.status).toBe(200);
    expect(await parseBody(res)).toMatchObject({
      version: 1,
      issuer: 'https://revealui.com',
      audience: 'revealui-license',
      keys: [
        {
          role: 'current',
          algorithm: 'EdDSA',
          publicKey,
          jwtKid: '874261a3',
          keyId: '06e3fd8fda29bb60ab59557de61edb0aecdb231134be30e75b455f8e1b792fa9',
        },
      ],
      digest: 'df4d41347f530f5ba0792c2a9a64cc6dd7faacecec92f9f2a87747e3f85eb917',
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns 503 without a key rather than an empty trust set or legacy fallback', async () => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    mockedTrustManifest.mockRejectedValueOnce(new Error('unconfigured'));
    const app = createApp();
    const res = await app.request('/public-key');
    expect(res.status).toBe(503);
    const body = await parseBody(res);
    expect(body).toEqual({ message: 'License trust set unavailable' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns 503 when the real core constructor rejects malformed configured keys', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'not a PEM';
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    const realCore =
      await vi.importActual<typeof import('@revealui/core/license')>('@revealui/core/license');
    mockedTrustManifest.mockImplementationOnce(() => realCore.getLicensePublicKeyTrustManifest());

    const res = await createApp().request('/public-key');
    expect(res.status).toBe(503);
    expect(await parseBody(res)).toEqual({ message: 'License trust set unavailable' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
