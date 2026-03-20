import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Stripe before imports
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      products = {
        list: vi.fn(),
      };
    },
  };
});

// Mock circuit breaker to pass through
vi.mock('@revealui/core/error-handling', () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  },
  CircuitBreakerOpenError: class extends Error {},
}));

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import app from '../pricing.js';

describe('GET /api/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns pricing response with fallback when Stripe is not configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.subscriptions).toHaveLength(4);
    expect(data.credits).toHaveLength(3);
    expect(data.perpetual).toHaveLength(3);

    // Fallback prices should be populated
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    expect(pro.period).toBe('/month');
  });

  it('returns structural data from contracts', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    const data = await res.json();

    const free = data.subscriptions.find((t: { id: string }) => t.id === 'free');
    expect(free.name).toBe('Free (OSS)');
    expect(free.features.length).toBeGreaterThan(0);
    expect(free.cta).toBe('Get Started');
  });

  it('sets cache headers', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('returns all credit bundles with fallback prices', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    const data = await res.json();

    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard');
    expect(standard.price).toBe('$50');
    expect(standard.costPer).toBe('$0.00083/task');
    expect(standard.tasks).toBe('60,000');
  });

  it('returns all perpetual tiers with fallback prices', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    const data = await res.json();

    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(proPerpetual.price).toBe('$299');
    expect(proPerpetual.renewal).toBe('$99/yr for continued support');
  });

  it('response matches expected shape', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const res = await app.request('/');
    const data = await res.json();

    // Verify shape
    expect(data).toHaveProperty('subscriptions');
    expect(data).toHaveProperty('credits');
    expect(data).toHaveProperty('perpetual');

    // Verify subscription tier shape
    for (const tier of data.subscriptions) {
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('name');
      expect(tier).toHaveProperty('description');
      expect(tier).toHaveProperty('features');
      expect(tier).toHaveProperty('cta');
      expect(tier).toHaveProperty('ctaHref');
      expect(tier).toHaveProperty('highlighted');
    }
  });
});

// ---------------------------------------------------------------------------
// Stripe integration tests
//
// These tests use vi.resetModules() + dynamic import to get a fresh copy of
// pricing.ts with an unset cachedStripe, then stub STRIPE_SECRET_KEY so
// getStripeClient() creates a real (mocked) Stripe instance.
//
// The Stripe mock uses a shared module-level vi.fn() so all MockStripe
// instances share the same `list` mock reference. This is required because
// the route creates its own Stripe instance internally.
// ---------------------------------------------------------------------------

describe('GET /api/pricing — Stripe integration', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic module re-import requires any
  let freshApp: any;
  // Shared mock fn — set during beforeAll, reused across all instances of MockStripe
  const sharedMockList = vi.fn();

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake123');

    // Re-register mocks after resetModules (vi.mock hoisting no longer applies).
    // The Stripe mock uses sharedMockList so the route's internal instance shares
    // the same fn reference that tests can configure via mockResolvedValue.
    vi.doMock('stripe', () => ({
      default: class MockStripe {
        products = { list: sharedMockList };
      },
    }));

    vi.doMock('@revealui/core/error-handling', () => ({
      CircuitBreaker: class {
        async execute<T>(fn: () => Promise<T>): Promise<T> {
          return fn();
        }
      },
      CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
        constructor(message?: string) {
          super(message);
          this.name = 'CircuitBreakerOpenError';
        }
      },
    }));

    vi.doMock('@revealui/core/observability/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    freshApp = (await import('../pricing.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Stripe prices for subscription tiers when products list succeeds', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        {
          name: 'Pro',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 4900, recurring: { interval: 'month' } },
        },
        {
          name: 'Max',
          metadata: { revealui_track: 'subscription', revealui_tier: 'max' },
          default_price: { unit_amount: 14900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    expect(pro.period).toBe('/month');

    const max = data.subscriptions.find((t: { id: string }) => t.id === 'max');
    expect(max.price).toBe('$149');
    expect(max.period).toBe('/month');
  });

  it('uses Stripe prices for credit track products', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        {
          name: 'Standard',
          metadata: {
            revealui_track: 'credit',
            revealui_tier: 'standard',
            revealui_price_note: 'one-time',
            revealui_cost_per: '$0.00083/task',
          },
          default_price: { unit_amount: 5000 },
        },
        {
          name: 'Scale',
          metadata: {
            revealui_track: 'credit',
            revealui_tier: 'scale',
            revealui_price_note: 'one-time',
            revealui_cost_per: '$0.00071/task',
          },
          default_price: { unit_amount: 25000 },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard');
    expect(standard.price).toBe('$50');
    expect(standard.costPer).toBe('$0.00083/task');

    const scale = data.credits.find((b: { name: string }) => b.name === 'Scale');
    expect(scale.price).toBe('$250');
    expect(scale.costPer).toBe('$0.00071/task');
  });

  it('uses Stripe prices for perpetual track products', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        {
          name: 'Pro Perpetual',
          metadata: {
            revealui_track: 'perpetual',
            revealui_tier: 'pro_perpetual',
            revealui_price_note: 'one-time',
            revealui_renewal: '$99/yr for continued support',
          },
          default_price: { unit_amount: 29900 },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(proPerpetual.price).toBe('$299');
    expect(proPerpetual.priceNote).toBe('one-time');
    expect(proPerpetual.renewal).toBe('$99/yr for continued support');
  });

  it('falls back to defaults when Stripe throws a generic error', async () => {
    sharedMockList.mockRejectedValue(new Error('Stripe network timeout'));

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    // Falls back to hardcoded prices
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
  });

  it('skips products missing required metadata fields', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        // Missing revealui_tier — should be skipped
        {
          name: 'Mystery Product',
          metadata: { revealui_track: 'subscription' },
          default_price: { unit_amount: 9900, recurring: { interval: 'month' } },
        },
        // Missing revealui_track — should be skipped
        {
          name: 'Another Product',
          metadata: { revealui_tier: 'pro' },
          default_price: { unit_amount: 4900, recurring: { interval: 'month' } },
        },
        // No metadata at all — should be skipped
        {
          name: 'No Meta',
          metadata: {},
          default_price: { unit_amount: 1900 },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    // All subscription tiers fall back to default prices because none mapped
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
  });

  it('skips products with zero or missing unit_amount', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        // unit_amount is 0 — falsy, should be skipped
        {
          name: 'Free Tier',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 0 },
        },
        // default_price is null — should be skipped
        {
          name: 'No Price',
          metadata: { revealui_track: 'subscription', revealui_tier: 'max' },
          default_price: null,
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    // Both skipped → falls back to hardcoded prices
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');

    const max = data.subscriptions.find((t: { id: string }) => t.id === 'max');
    expect(max.price).toBe('$149');
  });

  it('formats yearly subscription interval as /year', async () => {
    sharedMockList.mockResolvedValue({
      data: [
        {
          name: 'Enterprise Annual',
          metadata: { revealui_track: 'subscription', revealui_tier: 'enterprise' },
          default_price: { unit_amount: 29900, recurring: { interval: 'year' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const enterprise = data.subscriptions.find((t: { id: string }) => t.id === 'enterprise');
    expect(enterprise.price).toBe('$299');
    expect(enterprise.period).toBe('/year');
  });

  it('always sets Cache-Control header even when Stripe fails', async () => {
    sharedMockList.mockRejectedValue(new Error('connection refused'));

    const res = await freshApp.request('/');
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker isolation
//
// This describe uses its own vi.resetModules() + dynamic import so the
// circuit breaker open path can be tested without disturbing the shared
// freshApp/mockList state above.
// ---------------------------------------------------------------------------

describe('GET /api/pricing — circuit breaker open', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic module re-import requires any
  let cbApp: any;

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake_cb');

    vi.doMock('@revealui/core/error-handling', () => {
      class CircuitBreakerOpenError extends Error {
        constructor(message?: string) {
          super(message);
          this.name = 'CircuitBreakerOpenError';
        }
      }
      return {
        CircuitBreaker: class {
          async execute<T>(_fn: () => Promise<T>): Promise<T> {
            throw new CircuitBreakerOpenError('circuit open');
          }
        },
        CircuitBreakerOpenError,
      };
    });

    vi.doMock('stripe', () => ({
      default: class MockStripe {
        products = { list: vi.fn() };
      },
    }));

    vi.doMock('@revealui/core/observability/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    cbApp = (await import('../pricing.js')).default;
  });

  it('falls back to defaults and returns 200 when circuit breaker is open', async () => {
    const res = await cbApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    expect(pro.period).toBe('/month');
  });

  it('still sets Cache-Control header when circuit breaker is open', async () => {
    const res = await cbApp.request('/');
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
  });
});
