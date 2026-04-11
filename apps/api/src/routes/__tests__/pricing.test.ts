import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
// tiers fall back to static prices  -  regardless of the cached client.
// ---------------------------------------------------------------------------

describe('GET /api/pricing  -  Stripe active path', () => {
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

describe('GET /api/pricing  -  Stripe integration', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic module re-import requires any
  let freshApp: any;
  // Shared mock fn  -  set during beforeAll, reused across all instances of MockStripe
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
        // Missing revealui_tier  -  should be skipped
        {
          name: 'Mystery Product',
          metadata: { revealui_track: 'subscription' },
          default_price: { unit_amount: 9900, recurring: { interval: 'month' } },
        },
        // Missing revealui_track  -  should be skipped
        {
          name: 'Another Product',
          metadata: { revealui_tier: 'pro' },
          default_price: { unit_amount: 4900, recurring: { interval: 'month' } },
        },
        // No metadata at all  -  should be skipped
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
        // unit_amount is 0  -  falsy, should be skipped
        {
          name: 'Free Tier',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 0 },
        },
        // default_price is null  -  should be skipped
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

describe('GET /api/pricing  -  circuit breaker open', () => {
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

// ---------------------------------------------------------------------------
// Metadata defaults, unknown tracks, and formatting edge cases
// ---------------------------------------------------------------------------

describe('GET /api/pricing  -  metadata defaults and edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    circuitBreakerShouldThrow = false;
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy');
  });

  it('defaults credit priceNote to "one-time" and costPer to empty string when metadata is absent', async () => {
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Starter', 'credit', 'starter', 1000)],
    });

    const res = await app.request('/');
    const data = await res.json();

    const starter = data.credits.find((b: { name: string }) => b.name === 'Starter');
    expect(starter.price).toBe('$10');
    expect(starter.priceNote).toBe('one-time');
    expect(starter.costPer).toBe('');
  });

  it('defaults perpetual priceNote to "one-time" and renewal to empty string when metadata is absent', async () => {
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Pro Perpetual', 'perpetual', 'pro_perpetual', 29900)],
    });

    const res = await app.request('/');
    const data = await res.json();

    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(proPerpetual.price).toBe('$299');
    expect(proPerpetual.priceNote).toBe('one-time');
    expect(proPerpetual.renewal).toBe('');
  });

  it('silently ignores products with an unknown track type', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Widget',
          metadata: { revealui_track: 'widget', revealui_tier: 'basic' },
          default_price: { unit_amount: 999 },
        },
      ],
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    // Unknown track is skipped  -  all tiers use fallback
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
  });

  it('returns undefined period when subscription product has no recurring interval', async () => {
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Pro', 'subscription', 'pro', 4900)],
    });

    const res = await app.request('/');
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    expect(pro.period).toBeUndefined();
  });

  it('rounds non-integer cent amounts with toFixed(0)', async () => {
    // 4999 cents / 100 = 49.99, toFixed(0) rounds to '50'
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Pro', 'subscription', 'pro', 4999, 'month')],
    });

    const res = await app.request('/');
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$50');
  });

  it('last product wins when duplicate tier entries exist in Stripe response', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        makeStripeProduct('Pro v1', 'subscription', 'pro', 3900, 'month'),
        makeStripeProduct('Pro v2', 'subscription', 'pro', 5900, 'month'),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    // Map.set overwrites  -  second entry wins
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$59');
  });

  it('does not crash when product metadata is null', async () => {
    mockProductsList.mockResolvedValue({
      data: [{ name: 'Ghost', metadata: null, default_price: { unit_amount: 1000 } }],
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    // Null metadata is safely skipped via optional chaining
    expect(data.subscriptions).toHaveLength(4);
  });

  it('enriches all four subscription tiers simultaneously from Stripe', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        makeStripeProduct('Free', 'subscription', 'free', 0),
        makeStripeProduct('Pro', 'subscription', 'pro', 4900, 'month'),
        makeStripeProduct('Max', 'subscription', 'max', 14900, 'month'),
        makeStripeProduct('Enterprise', 'subscription', 'enterprise', 29900, 'month'),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    // Free: unit_amount=0 is falsy → skipped → fallback
    const free = data.subscriptions.find((t: { id: string }) => t.id === 'free');
    expect(free.price).toBe('$0');
    // Others: enriched from Stripe
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');
    const max = data.subscriptions.find((t: { id: string }) => t.id === 'max');
    expect(max.price).toBe('$149');
    const enterprise = data.subscriptions.find((t: { id: string }) => t.id === 'enterprise');
    expect(enterprise.price).toBe('$299');
  });

  it('enriches all three credit bundles simultaneously from Stripe', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        makeStripeProduct('Starter', 'credit', 'starter', 1000, undefined, {
          revealui_price_note: 'one-time',
          revealui_cost_per: '$0.001/task',
        }),
        makeStripeProduct('Standard', 'credit', 'standard', 5000, undefined, {
          revealui_price_note: 'one-time',
          revealui_cost_per: '$0.00083/task',
        }),
        makeStripeProduct('Scale', 'credit', 'scale', 25000, undefined, {
          revealui_price_note: 'one-time',
          revealui_cost_per: '$0.00071/task',
        }),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    expect(data.credits).toHaveLength(3);
    const starter = data.credits.find((b: { name: string }) => b.name === 'Starter');
    expect(starter.price).toBe('$10');
    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard');
    expect(standard.price).toBe('$50');
    const scale = data.credits.find((b: { name: string }) => b.name === 'Scale');
    expect(scale.price).toBe('$250');
  });

  it('enriches all three perpetual tiers simultaneously from Stripe', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        makeStripeProduct('Pro Perpetual', 'perpetual', 'pro_perpetual', 29900, undefined, {
          revealui_price_note: 'one-time',
          revealui_renewal: '$99/yr',
        }),
        makeStripeProduct('Agency Perpetual', 'perpetual', 'agency_perpetual', 79900, undefined, {
          revealui_price_note: 'one-time',
          revealui_renewal: '$199/yr',
        }),
        makeStripeProduct('Forge Perpetual', 'perpetual', 'forge_perpetual', 199900, undefined, {
          revealui_price_note: 'one-time',
          revealui_renewal: '$499/yr',
        }),
      ],
    });

    const res = await app.request('/');
    const data = await res.json();

    expect(data.perpetual).toHaveLength(3);
    const pro = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(pro.price).toBe('$299');
    const agency = data.perpetual.find((t: { name: string }) => t.name === 'Agency Perpetual');
    expect(agency.price).toBe('$799');
    const forge = data.perpetual.find((t: { name: string }) => t.name === 'Forge Perpetual');
    expect(forge.price).toBe('$1999');
  });

  it('mixes Stripe enrichment with fallback across tracks', async () => {
    // Only subscription from Stripe  -  credits and perpetual fall back
    mockProductsList.mockResolvedValue({
      data: [makeStripeProduct('Pro', 'subscription', 'pro', 3900, 'month')],
    });

    const res = await app.request('/');
    const data = await res.json();

    // Subscription: Stripe price
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$39');
    // Credit: fallback
    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard');
    expect(standard.price).toBe('$50');
    // Perpetual: fallback
    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(proPerpetual.price).toBe('$299');
  });
});
