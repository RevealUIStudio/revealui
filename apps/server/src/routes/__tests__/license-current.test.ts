/**
 * GET /api/license/current — authenticated owner license fetch.
 * Flag unset → 404. Never mints. Does not log the JWT.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: vi.fn(() => 'live'),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ ai: true })),
}));

vi.mock('@revealui/core/license', () => ({
  normalizePem: (raw: string) => raw,
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  validateLicenseKey: vi.fn(),
  validateLicenseKeyForRefresh: vi.fn(),
  generateLicenseKey: vi.fn(),
  getPublicKeys: vi.fn(() => ['pub-key']),
  readLicenseJti: vi.fn(async () => 'jti-1'),
}));

vi.mock('@revealui/core/license/mint-client', () => ({
  canMintLicense: vi.fn(() => false),
  mintConfigMissingMessage: vi.fn(() => 'not configured'),
  mintLicenseKey: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
  isJtiRevoked: vi.fn(async () => false),
}));

vi.mock('@revealui/db/schema', () => ({
  licenses: {
    userId: 'user_id',
    licenseKey: 'license_key',
    status: 'status',
    tier: 'tier',
    expiresAt: 'expires_at',
    deletedAt: 'deleted_at',
    mode: 'mode',
    createdAt: 'created_at',
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

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { recordMilestoneMeterFirstSafe } from '../../lib/nudges/milestone-meters.js';
import licenseApp from '../license.js';

const JWT = 'eyJhbGciOiJFZERTQSJ9.payload.sig';
const USER = { id: 'user-a', email: 'a@example.com', name: 'A', role: 'user' };

function mockLicenseRows(
  rows: Array<{
    licenseKey: string;
    status: string;
    tier: string;
    expiresAt: Date | null;
  }>,
  memberships: Array<{ accountId: string }> = [{ accountId: 'acct-1' }],
) {
  vi.mocked(getClient).mockReturnValue({
    select: (cols: Record<string, unknown>) => {
      const isMembership = cols && 'accountId' in cols;
      return {
        from: () => ({
          where: () => {
            if (isMembership) {
              return { limit: () => Promise.resolve(memberships) };
            }
            return {
              orderBy: () => ({
                limit: () => Promise.resolve(rows),
              }),
            };
          },
        }),
      };
    },
  } as never);
}

function createAuthedApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json(
        { success: false, error: err.message, code: `HTTP_${err.status}` },
        err.status,
      );
    }
    return c.json({ success: false, error: 'Internal error' }, 500);
  });
  app.use('*', async (c, next) => {
    c.set('user', USER as never);
    await next();
  });
  app.route('/', licenseApp);
  return app;
}

function createAnonApp() {
  const app = new Hono();
  app.route('/', licenseApp);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REVEALUI_LICENSE_AUTO_PROVISION;
});

afterEach(() => {
  delete process.env.REVEALUI_LICENSE_AUTO_PROVISION;
});

describe('GET /current', () => {
  it('returns 404 APIErrorResponse when the flag is unset (HC7)', async () => {
    const res = await createAuthedApp().request('/current');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Not found', code: 'HTTP_404' });
    expect(JSON.stringify(body)).not.toContain('eyJ');
  });

  it('returns 404 when the flag is not the string true', async () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'yes';
    const res = await createAuthedApp().request('/current');
    expect(res.status).toBe(404);
  });

  it('returns active JWT for the signed-in owner when the flag is on (HC1/HC4)', async () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'true';
    mockLicenseRows([
      {
        licenseKey: JWT,
        status: 'active',
        tier: 'pro',
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    ]);
    const res = await createAuthedApp().request('/current');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      licenseKey: JWT,
      status: 'active',
      tier: 'pro',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(recordMilestoneMeterFirstSafe).toHaveBeenCalledWith(
      'acct-1',
      'license_key_fetched',
      expect.objectContaining({ userId: 'user-a', path: 'license/current' }),
    );
  });

  it('returns none with null JWT when the owner has no row', async () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'true';
    mockLicenseRows([]);
    const res = await createAuthedApp().request('/current');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      licenseKey: null,
      status: 'none',
      tier: null,
      expiresAt: null,
    });
  });

  it('returns revoked with null JWT for a revoked latest row (HC4b)', async () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'true';
    mockLicenseRows([{ licenseKey: JWT, status: 'revoked', tier: 'pro', expiresAt: null }]);
    const res = await createAuthedApp().request('/current');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      licenseKey: null,
      status: 'revoked',
      tier: 'pro',
      expiresAt: null,
    });
  });

  it('does not log the JWT (HC9)', async () => {
    process.env.REVEALUI_LICENSE_AUTO_PROVISION = 'true';
    mockLicenseRows([{ licenseKey: JWT, status: 'active', tier: 'pro', expiresAt: null }]);
    await createAuthedApp().request('/current');
    const dumped = JSON.stringify(vi.mocked(logger).info.mock.calls);
    expect(dumped).not.toContain('eyJ');
    expect(dumped).not.toContain(JWT);
  });

  it('does not mint and does not require auth on the sub-app when flag is off', async () => {
    const res = await createAnonApp().request('/current');
    expect(res.status).toBe(404);
  });
});
