/**
 * POST /api/license/refresh — GAP-287 PR-1.
 *
 * The refresh endpoint returns the CURRENT stored license key for the customer
 * identified by a presented (possibly recently-expired) key. It never mints.
 * Auth is a recently-valid signed key bound to an explicit customerId
 * (validateLicenseKeyForRefresh) plus an ACTIVE license row for that bind.
 * A JWT for customer A must not return customer B's stored key. Unbound
 * refresh fails closed. Every cryptographic / row failure returns the
 * identical 403 body so nothing distinguishes revoked / missing / lapsed.
 *
 * The bounded-expiry WINDOW logic (accept within REFRESH_ACCEPT_DAYS, reject
 * beyond) is unit-tested at the crypto layer in
 * packages/core/src/__tests__/license.test.ts. Here the core validator is
 * mocked, so the route sees "verified → payload" vs "not verified → null".
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: vi.fn(() => 'live'),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ ai: true })),
}));

vi.mock('@revealui/core/license', () => ({
  normalizePem: (raw: string) => raw.split('\\n').join('\n'),
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  validateLicenseKey: vi.fn(),
  validateLicenseKeyForRefresh: vi.fn(),
  generateLicenseKey: vi.fn(),
  getPublicKeys: vi.fn(() => ['pub-key']),
}));

vi.mock('@revealui/core/license/mint-client', () => ({
  canMintLicense: vi.fn(() => Boolean(process.env.REVEALUI_LICENSE_PRIVATE_KEY?.trim())),
  mintConfigMissingMessage: vi.fn(() => 'REVEALUI_LICENSE_PRIVATE_KEY not configured'),
  mintLicenseKey: vi.fn().mockResolvedValue('rv-license-key-test-123'),
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
    status: 'status',
    licenseKey: 'license_key',
    customerId: 'customer_id',
    deletedAt: 'deleted_at',
    mode: 'mode',
    createdAt: 'created_at',
  },
}));

import { getPublicKeys, validateLicenseKeyForRefresh } from '@revealui/core/license';
import { mintLicenseKey } from '@revealui/core/license/mint-client';
import { getClient, isJtiRevoked } from '@revealui/db';
import licenseApp from '../license.js';

const mockedRefreshValidate = vi.mocked(validateLicenseKeyForRefresh);
const mockedGetPublicKeys = vi.mocked(getPublicKeys);
const mockedGenerate = vi.mocked(mintLicenseKey);
const mockedIsJtiRevoked = vi.mocked(isJtiRevoked);

const VALID_PAYLOAD = {
  tier: 'pro' as const,
  customerId: 'cus_123',
  jti: 'jti-current',
  exp: Math.floor(Date.now() / 1000) + 86_400,
};

function createApp() {
  const app = new Hono();
  app.route('/', licenseApp);
  return app;
}

function post(body: unknown) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

function refreshBody(overrides: Record<string, unknown> = {}) {
  return { licenseKey: 'presented.key', customerId: 'cus_123', ...overrides };
}

/** Mock the refresh DB chain: select().from().where().orderBy().limit() → rows. */
function mockDbRows(rows: Array<{ licenseKey: string }>) {
  vi.mocked(getClient).mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      }),
    }),
  } as never);
}

function mockDbThrow() {
  vi.mocked(getClient).mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.reject(new Error('DB unavailable')),
          }),
        }),
      }),
    }),
  } as never);
}

const DENIED = { error: 'refresh_denied' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPublicKeys.mockReturnValue(['pub-key']);
  mockedIsJtiRevoked.mockResolvedValue(false);
});

describe('POST /refresh', () => {
  it('returns the stored current key for a valid current key', async () => {
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([{ licenseKey: 'stored.current.key' }]);

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ licenseKey: 'stored.current.key' });
  });

  it('returns the stored key for a key expired within the refresh window', async () => {
    // The core validator accepts a within-window expired token, so from the
    // route's view this is identical to a live key: a payload comes back and
    // the active row's stored key is returned.
    mockedRefreshValidate.mockResolvedValue({ ...VALID_PAYLOAD, jti: 'jti-stale' } as never);
    mockDbRows([{ licenseKey: 'stored.renewed.key' }]);

    const app = createApp();
    const res = await app.request(
      '/refresh',
      post(refreshBody({ licenseKey: 'recently.expired.key' })),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ licenseKey: 'stored.renewed.key' });
  });

  it('denies with 403 when the key is expired beyond the refresh window', async () => {
    // Beyond REFRESH_ACCEPT_DAYS the core validator returns null.
    mockedRefreshValidate.mockResolvedValue(null as never);
    mockDbRows([{ licenseKey: 'stored.key' }]);

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody({ licenseKey: 'ancient.key' })));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
  });

  it('denies with 403 when there is no active license row', async () => {
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([]); // active-status filter excludes revoked/expired/lapsed rows

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody()));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
  });

  it('denies with 403 for a revoked license (no active row survives the status filter)', async () => {
    // A revoked license has status != 'active', so the active-row query returns
    // nothing. This is row-level revocation, enforced by the active-row check.
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([]);

    const app = createApp();
    const res = await app.request(
      '/refresh',
      post(refreshBody({ licenseKey: 'revoked.customer.key' })),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
  });

  it('denies with 403 when no public key is configured', async () => {
    mockedGetPublicKeys.mockReturnValue([]);

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody()));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
    // Never even attempts verification without a key.
    expect(mockedRefreshValidate).not.toHaveBeenCalled();
  });

  it('fails closed with 403 when the DB lookup throws', async () => {
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbThrow();

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody()));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
  });

  it('never mints — mintLicenseKey is not called on any path', async () => {
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([{ licenseKey: 'stored.current.key' }]);

    const app = createApp();
    await app.request('/refresh', post(refreshBody()));

    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing licenseKey', async () => {
    const app = createApp();
    const res = await app.request('/refresh', post({ customerId: 'cus_123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a missing customerId (unbound refresh fails closed)', async () => {
    const app = createApp();
    const res = await app.request('/refresh', post({ licenseKey: 'presented.key' }));
    expect(res.status).toBe(400);
    expect(mockedRefreshValidate).not.toHaveBeenCalled();
  });

  it('denies with 403 for a whitespace-only customerId bind', async () => {
    const app = createApp();
    const res = await app.request(
      '/refresh',
      post({ licenseKey: 'presented.key', customerId: '   ' }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
    expect(mockedRefreshValidate).not.toHaveBeenCalled();
  });

  it("does not return customer B's key when the presented JWT is for customer A", async () => {
    mockedRefreshValidate.mockResolvedValue({ ...VALID_PAYLOAD, customerId: 'cus_A' } as never);
    mockDbRows([{ licenseKey: 'customer-b-secret-key' }]);

    const app = createApp();
    const res = await app.request(
      '/refresh',
      post({ licenseKey: 'customer-a.key', customerId: 'cus_B' }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
    expect(mockedRefreshValidate).toHaveBeenCalledWith('customer-a.key', ['pub-key'], 'cus_B');
  });

  it('passes the bound customerId into validateLicenseKeyForRefresh', async () => {
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([{ licenseKey: 'stored.current.key' }]);

    const app = createApp();
    await app.request('/refresh', post(refreshBody({ licenseKey: 'presented.key' })));

    expect(mockedRefreshValidate).toHaveBeenCalledWith('presented.key', ['pub-key'], 'cus_123');
  });

  it('every denial is byte-identical (same status and body)', async () => {
    const app = createApp();

    // Expired-beyond-window
    mockedRefreshValidate.mockResolvedValue(null as never);
    mockDbRows([{ licenseKey: 'stored.key' }]);
    const beyond = await app.request('/refresh', post(refreshBody({ licenseKey: 'a' })));

    // No active row
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbRows([]);
    const noRow = await app.request('/refresh', post(refreshBody({ licenseKey: 'b' })));

    // No public key
    mockedGetPublicKeys.mockReturnValue([]);
    const noKey = await app.request('/refresh', post(refreshBody({ licenseKey: 'c' })));
    mockedGetPublicKeys.mockReturnValue(['pub-key']);

    // DB throw
    mockedRefreshValidate.mockResolvedValue(VALID_PAYLOAD as never);
    mockDbThrow();
    const dbErr = await app.request('/refresh', post(refreshBody({ licenseKey: 'd' })));

    for (const res of [beyond, noRow, noKey, dbErr]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(DENIED);
    }
  });

  // Spec §4 binding 2 / GAP-260 P4-5: a token whose specific `jti` was revoked
  // must be refused even when its customer's license row is still ACTIVE.
  it('denies with 403 for a revoked jti even when the customer row is active (GAP-260)', async () => {
    mockedRefreshValidate.mockResolvedValue({ ...VALID_PAYLOAD, jti: 'jti-revoked' } as never);
    mockedIsJtiRevoked.mockResolvedValueOnce(true);
    mockDbRows([{ licenseKey: 'stored.current.key' }]); // customer row is active

    const app = createApp();
    const res = await app.request('/refresh', post(refreshBody({ licenseKey: 'leaked.old.key' })));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(DENIED);
    expect(mockedIsJtiRevoked).toHaveBeenCalledWith(expect.anything(), 'jti-revoked');
  });
});
