import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'pro'),
  getLicensePayload: vi.fn(),
  isLicensed: vi.fn(() => true),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'pro'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getLicensePayload } from '@revealui/core/license';
import { errorHandler } from '../error.js';
import { checkLicenseStatus, resetDbStatusCache } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function createApp(queryFn: (customerId: string) => Promise<string | null>) {
  const app = new Hono();
  // biome-ignore lint/suspicious/noExplicitAny: test helper — middleware type is flexible
  app.use('*', checkLicenseStatus(queryFn) as any);
  app.get('/resource', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

afterEach(() => {
  resetDbStatusCache();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('checkLicenseStatus', () => {
  it('passes for active license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('active');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).toHaveBeenCalledWith('cus_1');
  });

  it('returns 403 for revoked license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('revoked');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('revoked');
  });

  it('returns 403 for expired license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('expired');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('expired');
  });

  it('skips DB check for free tier (no payload)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('caches DB result and does not query every request', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('active');

    const app = createApp(queryFn);

    // First request should query
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Second request should use cache
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('defaults to active when query returns null', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue(null);

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
  });
});
