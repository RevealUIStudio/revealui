import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @revealui/core modules
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  isLicensed: vi.fn(),
  getCurrentTier: vi.fn(() => 'free'),
  getLicensePayload: vi.fn(() => null),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getRequiredTier: vi.fn(() => 'pro'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock x402 middleware
vi.mock('../x402.js', () => ({
  getX402Config: vi.fn(() => ({ enabled: false })),
  buildPaymentRequired: vi.fn(() => ({
    resource: '/protected/resource',
    amount: '1000',
    currency: 'USDC',
  })),
  encodePaymentRequired: vi.fn(() => 'base64-encoded-payment-required'),
  verifyPayment: vi.fn(async () => ({ valid: false, error: 'Not verified' })),
}));

import { isFeatureEnabled } from '@revealui/core/features';
import { getCurrentTier } from '@revealui/core/license';
import { errorHandler } from '../error.js';
import { requireFeature } from '../license.js';
import { getX402Config, verifyPayment } from '../x402.js';

const mockedGetCurrentTier = vi.mocked(getCurrentTier);
const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled);
const mockedGetX402Config = vi.mocked(getX402Config);
const mockedVerifyPayment = vi.mocked(verifyPayment);

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function createApp(
  middleware: Parameters<InstanceType<typeof Hono>['use']>[1],
  entitlements?: { tier?: string; features?: Record<string, boolean> },
) {
  const app = new Hono();
  if (entitlements) {
    app.use('/protected/*', async (c, next) => {
      c.set('entitlements', entitlements);
      await next();
    });
  }
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('/protected/*', middleware as any);
  app.get('/protected/resource', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetX402Config.mockReturnValue({ enabled: false } as ReturnType<typeof getX402Config>);
});

// ---------------------------------------------------------------------------
// requireFeature
// ---------------------------------------------------------------------------
describe('requireFeature', () => {
  it('returns 403 when feature is disabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedGetCurrentTier.mockReturnValue('free');

    const app = createApp(requireFeature('ai'));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('ai');
    expect(body.error).toContain('revealui.com/pricing');
  });

  it('passes when feature is enabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(true);

    const app = createApp(requireFeature('ai'));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
  });

  it('includes required tier in error message', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedGetCurrentTier.mockReturnValue('free');

    const app = createApp(requireFeature('multiTenant'));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('multiTenant');
  });

  it('prefers request-scoped entitlement features over global feature state', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedGetCurrentTier.mockReturnValue('free');

    const app = createApp(requireFeature('ai'), {
      tier: 'pro',
      features: { ai: true },
    });
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(200);
  });

  it('can require request-scoped entitlements without falling back to global feature state', async () => {
    mockedIsFeatureEnabled.mockReturnValue(true);
    mockedGetCurrentTier.mockReturnValue('pro');

    const app = createApp(requireFeature('ai', { mode: 'entitlements' }));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('ai');
    expect(body.error).toContain('free');
  });

  it('passes in entitlement-only mode when the request entitlements enable the feature', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedGetCurrentTier.mockReturnValue('free');

    const app = createApp(requireFeature('ai', { mode: 'entitlements' }), {
      tier: 'pro',
      features: { ai: true },
    });
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(200);
  });

  it('supports entitlement-only gating for non-AI paid features', async () => {
    mockedIsFeatureEnabled.mockReturnValue(true);
    mockedGetCurrentTier.mockReturnValue('pro');

    const deniedApp = createApp(requireFeature('dashboard', { mode: 'entitlements' }));
    const deniedRes = await deniedApp.request('/protected/resource');

    expect(deniedRes.status).toBe(403);

    const allowedApp = createApp(requireFeature('dashboard', { mode: 'entitlements' }), {
      tier: 'pro',
      features: { dashboard: true },
    });
    const allowedRes = await allowedApp.request('/protected/resource');

    expect(allowedRes.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// requireFeature  -  x402 enabled
// ---------------------------------------------------------------------------
describe('requireFeature  -  x402', () => {
  beforeEach(() => {
    mockedGetX402Config.mockReturnValue({
      enabled: true,
      receivingAddress: '0x1234',
      pricePerTask: '0.001',
      network: 'base-sepolia',
      facilitatorUrl: 'https://x402.org/facilitator',
      usdcAsset: '0xUSDC',
      maxTimeoutSeconds: 300,
    } as ReturnType<typeof getX402Config>);
  });

  it('returns 402 with feature name header when x402 is enabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedGetCurrentTier.mockReturnValue('free');

    const app = createApp(requireFeature('ai'));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(402);
    const body = await parseBody(res);
    expect(body.code).toBe('HTTP_402');
    expect(res.headers.get('X-REVEALUI-FEATURE')).toBe('ai');
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBeTruthy();
  });

  it('passes when valid x402 payment for feature', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedVerifyPayment.mockResolvedValue({ valid: true });

    const app = createApp(requireFeature('ai'));
    const res = await app.request('/protected/resource', {
      headers: { 'x-payment-payload': 'valid-feature-payment' },
    });

    expect(res.status).toBe(200);
  });

  it('returns 402 when feature payment is invalid', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    mockedVerifyPayment.mockResolvedValue({ valid: false, error: 'Invalid payment' });

    const app = createApp(requireFeature('ai'));
    const res = await app.request('/protected/resource', {
      headers: { 'x-payment-payload': 'bad-payment' },
    });

    expect(res.status).toBe(402);
  });

  it('returns 402 in entitlement-only mode when global feature state is enabled but request entitlements are missing', async () => {
    mockedIsFeatureEnabled.mockReturnValue(true);
    mockedGetCurrentTier.mockReturnValue('pro');

    const app = createApp(requireFeature('ai', { mode: 'entitlements' }));
    const res = await app.request('/protected/resource');

    expect(res.status).toBe(402);
    expect(res.headers.get('X-REVEALUI-FEATURE')).toBe('ai');
  });
});
