import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level spy shared across the MockStripe instances.
// The source caches the first Stripe instance, so all tests share one spy.
const mockProductsList = vi.fn();

// Mock Stripe before imports
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      products = { list: mockProductsList };
    },
  };
});

// Mock circuit breaker to pass through by default.
// Individual tests can override CircuitBreakerOpenError by throwing it.
let circuitBreakerShouldThrow = false;
vi.mock('@revealui/core/error-handling', () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (circuitBreakerShouldThrow) throw new CircuitBreakerOpenErrorStub();
      return fn();
    }
  },
  // Stub exported so tests can reference it without a dynamic import
  CircuitBreakerOpenError: class CircuitBreakerOpenErrorStub extends Error {},
}));

class CircuitBreakerOpenErrorStub extends Error {}

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import app from '../pricing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Stripe product stub with the RevealUI metadata shape. */
function makeStripeProduct(
  name: string,
  track: 'subscription' | 'credit' | 'perpetual',
  tier: string,
  unitAmount: number,
  interval?: string,
  meta?: Record<string, string>,
) {
  return {
    name,
    metadata: {
      revealui_track: track,
      revealui_tier: tier,
      ...meta,
    },
    default_price: {
      unit_amount: unitAmount,
      recurring: interval ? { interval } : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Stripe active tests run FIRST so that cachedStripe is a live MockStripe
// instance before the fallback suite runs. The fallback suite's beforeEach
// then stubs mockProductsList to return [] so no products match and all
// tiers fall back to static prices — regardless of the cached client.
// ---------------------------------------------------------------------------

describe('GET /api/pricing — Stripe active path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    circuitBreakerShouldThrow = false;
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy');
  });

  it('uses Stripe prices when products.list returns matching subscription products', async () => {
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Pro', 'subscription', 'pro', 4900, 'month')],
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    expect(pro.period).toBe('/month');
  });

  it('falls back gracefully when products.list throws', async () => {
    mockProductsList.mockRejectedValue(new Error('Stripe network timeout'));

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49'); // fallback
  });

  it('falls back gracefully when circuit breaker is open', async () => {
    circuitBreakerShouldThrow = true;

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.subscriptions).toHaveLength(4);
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49'); // fallback
  });

  it('ignores products without revealui_track metadata', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        { name: 'Other Product', metadata: {}, default_price: { unit_amount: 9900 } },
        makeStripeProduct('Pro', 'subscription', 'pro', 4900, 'month'),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49'); // Stripe-enriched
    const free = data.subscriptions.find((t: { id: string }) => t.id === 'free');
    expect(free.price).toBe('$0'); // fallback (no Stripe product)
  });

  it('ignores products with null unit_amount', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Pro',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: null },
        },
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49'); // fallback
  });

  it('formats credit bundle prices from Stripe with metadata', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        makeStripeProduct('Standard', 'credit', 'standard', 3900, undefined, {
          revealui_price_note: 'one-time',
          revealui_cost_per: '$0.00065/task',
        }),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard');
    expect(standard.price).toBe('$39');
    expect(standard.costPer).toBe('$0.00065/task');
  });

  it('formats unit_amount in cents correctly ($4900 → $49)', async () => {
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Max', 'subscription', 'max', 14900, 'month')],
    });

    const res = await app.request('/');
    const data = await res.json();

    const max = data.subscriptions.find((t: { id: string }) => t.id === 'max');
    expect(max.price).toBe('$149');
  });
});

describe('GET /api/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // cachedStripe is already a MockStripe instance from the suite above.
    // Return an empty product list so no tiers match and all prices fall
    // back to the static contract values.
    mockProductsList.mockResolvedValue({ data: [] });
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
