import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
//
// requireDomain reads getLicensePayload() (mocked per-test to inject the
// `domains` claim) but uses the REAL hostMatchesLicensedDomains matcher from
// @revealui/core, so these tests exercise the actual Host-matching logic
// end-to-end rather than a stubbed matcher.
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', async () => {
  const actual =
    await vi.importActual<typeof import('@revealui/core/license')>('@revealui/core/license');
  return {
    ...actual,
    getLicensePayload: vi.fn(),
  };
});

vi.mock('@revealui/core/deployment-mode', () => ({
  detectDeploymentMode: vi.fn(() => 'hosted'),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'enterprise'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { detectDeploymentMode } from '@revealui/core/deployment-mode';
import { getLicensePayload } from '@revealui/core/license';
import { errorHandler } from '../error.js';
import { requireDomain } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);
const mockedDetectDeploymentMode = vi.mocked(detectDeploymentMode);

afterEach(() => {
  vi.unstubAllEnvs();
  mockedDetectDeploymentMode.mockReturnValue('hosted');
});

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
//
// requireDomain is a Host-based deployment domain-lock sourced from the signed
// JWT `domains` claim. Loopback is opt-in (NODE_ENV !== 'production'); a
// published API with a domains claim rejects Host: localhost. Hono's
// app.request defaults Host to `localhost` when none is given.
// ---------------------------------------------------------------------------
describe('requireDomain', () => {
  it('passes when no domain restrictions in license', async () => {
    mockedGetLicensePayload.mockReturnValue({ tier: 'enterprise', customerId: 'cus_1' });

    const res = await createApp().request('/resource', { headers: { host: 'evil.com' } });

    expect(res.status).toBe(200);
  });

  it('passes when the domains array is empty', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: [],
    });

    const res = await createApp().request('/resource', { headers: { host: 'evil.com' } });

    expect(res.status).toBe(200);
  });

  it('passes when the Host matches a licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const res = await createApp().request('/resource', { headers: { host: 'example.com' } });

    expect(res.status).toBe(200);
  });

  it('passes when the Host is a subdomain of a licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const res = await createApp().request('/resource', { headers: { host: 'app.example.com' } });

    expect(res.status).toBe(200);
  });

  it('allows an explicit localhost Host under a domain-restricted license outside production', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    // Trial / unpublished (NODE_ENV !== production) may still hit loopback.
    const res = await createApp().request('/resource', { headers: { host: 'localhost:4000' } });

    expect(res.status).toBe(200);
  });

  it('rejects localhost Host when a domains claim is present on a published API', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const res = await createApp().request('/resource', { headers: { host: 'localhost:4000' } });

    expect(res.status).toBe(403);
  });

  it('fails closed on Forge production when the license has an empty domains claim', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockedDetectDeploymentMode.mockReturnValue('forge');
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: [],
    });

    const res = await createApp().request('/resource', { headers: { host: 'evil.com' } });

    expect(res.status).toBe(403);
  });

  it('returns 403 when no Host header is present under a domain-restricted license (fail closed)', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    // HTTP/1.1 requires a Host header; a request without one cannot be proven
    // to target a licensed host, so the domain-lock rejects it.
    const res = await createApp().request('/resource');

    expect(res.status).toBe(403);
  });

  it('returns 403 when the Host does not match any licensed domain', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'enterprise',
      customerId: 'cus_1',
      domains: ['example.com'],
    });

    const res = await createApp().request('/resource', { headers: { host: 'evil.com' } });

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('evil.com');
    expect(body.error).toContain('not licensed');
  });

  it('passes when no license payload exists (free tier)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);

    const res = await createApp().request('/resource', { headers: { host: 'evil.com' } });

    expect(res.status).toBe(200);
  });
});
