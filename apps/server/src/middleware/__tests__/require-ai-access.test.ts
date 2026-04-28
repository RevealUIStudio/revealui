/**
 * requireAIAccess middleware tests
 *
 * Verifies free-tier local inference access, Pro+ passthrough,
 * and blocked state when neither license nor local inference exists.
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('../x402.js', () => ({
  getX402Config: vi.fn(() => ({ enabled: false })),
  buildPaymentRequired: vi.fn(() => ({
    resource: '/api/agent-stream',
    amount: '1000',
    currency: 'USDC',
  })),
  encodePaymentRequired: vi.fn(() => 'base64-encoded'),
  verifyPayment: vi.fn(async () => ({ valid: false, error: 'Not verified' })),
}));

import { isFeatureEnabled } from '@revealui/core/features';
import { requireAIAccess } from '../license.js';

const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(entitlements?: { tier?: string; features?: Record<string, boolean> }) {
  const app = new Hono();
  if (entitlements) {
    app.use('/api/*', async (c, next) => {
      c.set('entitlements', entitlements);
      await next();
    });
  }
  app.use('/api/*', requireAIAccess({ mode: 'entitlements' }));
  app.get('/api/agent-stream', (c) => {
    const mode = c.get('aiAccessMode') ?? 'full';
    return c.json({ ok: true, mode });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAIAccess middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsFeatureEnabled.mockReturnValue(false);
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.INFERENCE_SNAPS_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows Pro+ users with ai feature enabled', async () => {
    const app = createApp({ tier: 'pro', features: { ai: true } });
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('full');
  });

  it('allows free tier with OLLAMA_BASE_URL set and tags as local', async () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const app = createApp({ tier: 'free', features: { ai: false } });
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local');
  });

  it('allows free tier with INFERENCE_SNAPS_BASE_URL set and tags as local', async () => {
    process.env.INFERENCE_SNAPS_BASE_URL = 'http://localhost:9090/v1';
    const app = createApp({ tier: 'free', features: { ai: false } });
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local');
  });

  it('blocks free tier without local inference (403)', async () => {
    const app = createApp({ tier: 'free', features: { ai: false } });
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('OLLAMA_BASE_URL');
    expect(body.code).toBe('HTTP_403');
  });

  it('blocks when no entitlements and no local inference', async () => {
    const app = createApp();
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(403);
  });

  it('prefers ai entitlement over local inference check', async () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const app = createApp({ tier: 'pro', features: { ai: true } });
    const res = await app.request('/api/agent-stream');

    expect(res.status).toBe(200);
    const body = await res.json();
    // Pro user gets full access, not local-only
    expect(body.mode).toBe('full');
  });
});
