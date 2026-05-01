/**
 * License Route  -  Edge Case Tests
 *
 * Supplements license.test.ts with:
 * - Generate schema: expiresInDays:0 fails positive(), expiresInDays:3651 fails max(3650)
 * - Generate schema: maxSites:0 fails positive(), maxSites:10001 fails max(10_000)
 * - Generate schema: domains array with 101 items fails max(100)
 * - Generate schema: customerId:'' fails min(1)
 * - Generate: REVEALUI_ADMIN_API_KEY not set → 401
 * - Generate: expiresInDays defaults to 365 when not provided
 * - Generate: domains passed through to generateLicenseKey
 * - Verify: custom maxSites/maxUsers from JWT payload used over defaults
 * - Verify: DB throws during invalid-JWT status check → reason:invalid (fails open with logger.warn)
 * - Verify: \\n in public key env var is replaced with actual newline
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn((tier: string) => ({
    ai: tier !== 'free',
    collaboration: tier !== 'free',
    analytics: tier === 'enterprise',
  })),
}));

const { mockLoggerWarn, mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: mockLoggerInfo, error: mockLoggerError, warn: mockLoggerWarn },
}));

vi.mock('@revealui/core/license', () => ({
  validateLicenseKey: vi.fn(),
  generateLicenseKey: vi.fn(),
}));

vi.mock('@revealui/db/schema', () => ({
  licenses: { status: 'status', licenseKey: 'license_key' },
}));

// Default DB mock  -  returns no rows
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

import { generateLicenseKey, validateLicenseKey } from '@revealui/core/license';
import { getClient } from '@revealui/db';
import { Hono } from 'hono';
import licenseApp from '../license.js';

const mockedValidate = vi.mocked(validateLicenseKey);
const mockedGenerate = vi.mocked(generateLicenseKey);

function createApp() {
  const app = new Hono();
  app.route('/', licenseApp);
  return app;
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  };
}

const ADMIN_KEY = 'super-secret-admin-key';
const ADMIN_HEADER = { 'X-Admin-API-Key': ADMIN_KEY };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY;
  process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key';
  process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key';
  mockedGenerate.mockResolvedValue('generated.key');
  // Restore default getClient mock after clearAllMocks
  vi.mocked(getClient).mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  } as never);
});

// ---------------------------------------------------------------------------
// Tests  -  generate schema boundary validation
// ---------------------------------------------------------------------------

describe('POST /generate  -  expiresInDays schema boundaries', () => {
  it('returns 400 when expiresInDays is 0 (positive() requires > 0)', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc', expiresInDays: 0 }, ADMIN_HEADER),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when expiresInDays exceeds 3650 (max 10 years)', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc', expiresInDays: 3651 }, ADMIN_HEADER),
    );
    expect(res.status).toBe(400);
  });

  it('accepts expiresInDays at exactly 3650 (max boundary)', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc', expiresInDays: 3650 }, ADMIN_HEADER),
    );
    expect(res.status).toBe(201);
    // Route converts to seconds: 3650 * 24 * 60 * 60
    expect(mockedGenerate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      3650 * 24 * 60 * 60,
    );
  });

  it('defaults expiresInDays to 365 when not provided', async () => {
    const app = createApp();
    await app.request('/generate', post({ tier: 'pro', customerId: 'cus_abc' }, ADMIN_HEADER));

    // Route: const expiresInSeconds = (expiresInDays ?? 365) * 24 * 60 * 60
    expect(mockedGenerate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      365 * 24 * 60 * 60,
    );
  });
});

describe('POST /generate  -  maxSites and domains schema boundaries', () => {
  it('returns 400 when maxSites is 0 (positive() requires > 0)', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc', maxSites: 0 }, ADMIN_HEADER),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when maxSites exceeds 10_000', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc', maxSites: 10001 }, ADMIN_HEADER),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerId is an empty string', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'enterprise', customerId: '' }, ADMIN_HEADER),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when domains array has more than 100 items', async () => {
    const app = createApp();
    const res = await app.request(
      '/generate',
      post(
        { tier: 'enterprise', customerId: 'cus_ent', domains: Array(101).fill('example.com') },
        ADMIN_HEADER,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('passes domains to generateLicenseKey when provided', async () => {
    const app = createApp();
    await app.request(
      '/generate',
      post(
        { tier: 'enterprise', customerId: 'cus_ent', domains: ['example.com', 'app.example.com'] },
        ADMIN_HEADER,
      ),
    );

    expect(mockedGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ domains: ['example.com', 'app.example.com'] }),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('POST /generate  -  admin key not configured', () => {
  it('returns 401 when REVEALUI_ADMIN_API_KEY is not set in env', async () => {
    delete process.env.REVEALUI_ADMIN_API_KEY;
    const app = createApp();
    const res = await app.request(
      '/generate',
      post({ tier: 'pro', customerId: 'cus_abc' }, ADMIN_HEADER),
    );
    // Route: if (!(expectedKey && apiKey)) → 401 (expectedKey is falsy)
    expect(res.status).toBe(401);
  });

  it('calls logger.info when license is successfully generated', async () => {
    const app = createApp();
    await app.request(
      '/generate',
      post({ tier: 'enterprise', customerId: 'cus_ent' }, ADMIN_HEADER),
    );

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'License key generated',
      expect.objectContaining({ tier: 'enterprise', customerId: 'cus_ent' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests  -  verify endpoint edge cases
// ---------------------------------------------------------------------------

describe('POST /verify  -  custom maxSites/maxUsers from JWT payload', () => {
  it('uses maxSites from JWT payload when present (not fallback 5)', async () => {
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_abc',
      maxSites: 3,
      maxUsers: 10,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post({ licenseKey: 'valid.tok' }));
    const body = (await res.json()) as Record<string, unknown>;

    // Route: defaultMaxSites = payload.tier === 'enterprise' ? null : (payload.maxSites ?? 5)
    expect(body.maxSites).toBe(3);
    expect(body.maxUsers).toBe(10);
  });
});

describe('POST /verify  -  DB throws during invalid-JWT status check', () => {
  it('falls through to reason:invalid and calls logger.warn when DB throws on invalid JWT check', async () => {
    // JWT is invalid (validateLicenseKey returns null), then DB check for status also throws.
    // Route catches error, logs warn, and falls through to reason:'invalid'.
    mockedValidate.mockResolvedValue(null as never);
    vi.mocked(getClient).mockReturnValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error('DB connection lost')),
          }),
        }),
      }),
    } as never);

    const app = createApp();
    const res = await app.request('/verify', post({ licenseKey: 'bad.jwt.token' }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('invalid'); // DB warn path  -  falls through to default
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to check DB license status'),
      expect.anything(),
    );
  });
});

describe('POST /verify  -  public key \\n handling', () => {
  it('replaces literal \\\\n with newline in public key env var before calling validateLicenseKey', async () => {
    // Env vars from secrets managers often store newlines as the literal string '\\n'
    // Route: process.env.REVEALUI_LICENSE_PUBLIC_KEY?.replace(/\\n/g, '\n')
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'BEGIN KEY\\nsome-key-data\\nEND KEY';
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_123',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    const app = createApp();
    await app.request('/verify', post({ licenseKey: 'tok' }));

    // validateLicenseKey should have been called with newlines replaced
    expect(mockedValidate).toHaveBeenCalledWith('tok', 'BEGIN KEY\nsome-key-data\nEND KEY');
  });
});
