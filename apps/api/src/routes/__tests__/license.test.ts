import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@revealui/core/license', () => ({
  validateLicenseKey: vi.fn(),
  generateLicenseKey: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock DB to prevent real connection attempts during tests
vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  licenses: {
    status: 'status',
    licenseKey: 'license_key',
  },
}));

import { generateLicenseKey, validateLicenseKey } from '@revealui/core/license';
import { getClient } from '@revealui/db';
import licenseApp from '../license.js';

const mockedValidate = vi.mocked(validateLicenseKey);
const mockedGenerate = vi.mocked(generateLicenseKey);

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
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  };
}

// ---------------------------------------------------------------------------

describe('POST /verify', () => {
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

describe('POST /generate', () => {
  const ADMIN_KEY = 'secret-admin';

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

  it('returns 500 when private key is not configured', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    const app = createApp();
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    );
    expect(res.status).toBe(500);

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

  function mockDb(rows: { status: string }[]) {
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

  it('trusts the JWT when DB check throws (fails open)', async () => {
    mockedValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbThrow();

    const app = createApp();
    const res = await app.request('/verify', post('/verify', { licenseKey: 'valid.jwt' }));
    const body = await parseBody(res);
    expect(body.valid).toBe(true);
    expect(body.tier).toBe('pro');
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
