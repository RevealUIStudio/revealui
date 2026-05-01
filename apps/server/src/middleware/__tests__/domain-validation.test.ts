import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'enterprise'),
  getLicensePayload: vi.fn(),
  isLicensed: vi.fn(() => true),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'enterprise'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getLicensePayload } from '@revealui/core/license';
import { errorHandler } from '../error.js';
import { requireDomain } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function createApp() {
  const app = new Hono();
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('*', requireDomain() as any);
  app.get('/resource', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requireDomain', () => {
  it('passes when no domain restrictions in license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
  });

  it('passes when domains array is empty', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: [],
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
  });

  it('passes when Origin matches a licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const app = createApp();
    const res = await app.request('/resource', {
      headers: { Origin: 'https://example.com' },
    });

    expect(res.status).toBe(200);
  });

  it('passes when Origin is a subdomain of a licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const app = createApp();
    const res = await app.request('/resource', {
      headers: { Origin: 'https://app.example.com' },
    });

    expect(res.status).toBe(200);
  });

  it('returns 403 when Origin does not match any licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const app = createApp();
    const res = await app.request('/resource', {
      headers: { Origin: 'https://evil.com' },
    });

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('evil.com');
    expect(body.error).toContain('not licensed');
  });

  it('returns 403 when Origin header is missing but domains are restricted', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('Origin header required');
  });

  it('passes when no license payload exists (free tier)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
  });
});
