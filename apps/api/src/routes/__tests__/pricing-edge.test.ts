/**
 * Pricing Route — Edge Case Tests
 *
 * Supplements pricing.test.ts with:
 * - unit_amount: 0 treated as falsy → falls back to static price
 * - Missing revealui_tier → product skipped
 * - Missing metadata fields default to empty string for credit/perpetual
 * - Logger calls on Stripe failure (warn for circuit breaker, error for network)
 * - formatPrice edge values (round-down, large amounts)
 * - formatPeriod with non-standard intervals (year, week)
 * - default_price is null → falls back to static price
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

const mockProductsList = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('stripe', () => ({
  default: class MockStripe {
    products = { list: mockProductsList };
  },
}));

let circuitBreakerShouldThrow = false;

// NOTE: @revealui/core/error-handling is NOT hoisted here — the vi.doMock in
// beforeAll (after vi.resetModules) is the sole mock factory. A hoisted vi.mock
// used a *different* class for throwing vs exporting, causing `instanceof
// CircuitBreakerOpenError` to fail non-deterministically when Vitest's module
// linker resolved the hoisted factory instead of the doMock factory.

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: mockLoggerWarn, error: mockLoggerError },
}));

// ---------------------------------------------------------------------------
// We use vi.resetModules() + re-import to get a fresh pricing module
// so the cachedStripe starts as undefined for each test suite.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: dynamic module re-import
let freshApp: any;

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_edge');

  vi.doMock('stripe', () => ({
    default: class MockStripe {
      products = { list: mockProductsList };
    },
  }));

  vi.doMock('@revealui/core/error-handling', () => {
    // Must use a single class for both the throw site and the export so that
    // pricing.ts's `error instanceof CircuitBreakerOpenError` check passes.
    class MockOpenError extends Error {
      name = 'CircuitBreakerOpenError';
    }
    return {
      CircuitBreaker: class {
        async execute<T>(fn: () => Promise<T>): Promise<T> {
          if (circuitBreakerShouldThrow) throw new MockOpenError();
          return fn();
        }
      },
      CircuitBreakerOpenError: MockOpenError,
    };
  });

  vi.doMock('@revealui/core/observability/logger', () => ({
    logger: { info: vi.fn(), warn: mockLoggerWarn, error: mockLoggerError },
  }));

  freshApp = (await import('../pricing.js')).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  circuitBreakerShouldThrow = false;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/pricing — unit_amount: 0 edge case', () => {
  it('treats unit_amount: 0 as falsy and falls back to static price', async () => {
    // Free tiers in Stripe might have unit_amount: 0, which is falsy.
    // The route's `if (!defaultPrice?.unit_amount)` skips them → falls back.
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Free',
          metadata: { revealui_track: 'subscription', revealui_tier: 'free' },
          default_price: { unit_amount: 0 },
        },
      ],
    });

    const res = await freshApp.request('/');
    expect(res.status).toBe(200);
    const data = await res.json();

    const free = data.subscriptions.find((t: { id: string }) => t.id === 'free');
    // $0 from fallback, not from Stripe (since unit_amount: 0 is falsy)
    expect(free.price).toBe('$0');
  });
});

describe('GET /api/pricing — missing metadata fields', () => {
  it('skips product when revealui_tier is missing even if track is set', async () => {
    // Route: if (!(track && tier)) continue — both must be non-empty
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Unknown',
          metadata: { revealui_track: 'subscription' }, // tier missing
          default_price: { unit_amount: 9900, recurring: { interval: 'month' } },
        },
        {
          name: 'Pro',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 4900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    // Only "Pro" should be enriched; "Unknown" (no tier) is skipped
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49');

    // All 4 subscription tiers should still be returned (with fallbacks for non-matching ones)
    expect(data.subscriptions).toHaveLength(4);
  });

  it('skips product when revealui_track is missing even if tier is set', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Pro Orphan',
          metadata: { revealui_tier: 'pro' }, // track missing
          default_price: { unit_amount: 9900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    // Pro should fall back to static $49 since the Stripe product is skipped
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.price).toBe('$49'); // fallback
  });

  it('defaults credit revealui_cost_per to empty string when metadata is absent', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Starter',
          metadata: {
            revealui_track: 'credit',
            revealui_tier: 'starter',
            // revealui_cost_per intentionally absent
            revealui_price_note: 'one-time',
          },
          default_price: { unit_amount: 1000 },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const starter = data.credits.find((b: { name: string }) => b.name === 'Starter');
    // costPer falls back to '' when metadata key is absent
    expect(starter.costPer).toBe('');
  });

  it('defaults credit revealui_price_note to "one-time" when metadata is absent', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Starter',
          metadata: {
            revealui_track: 'credit',
            revealui_tier: 'starter',
            revealui_cost_per: '$0.001/task',
            // revealui_price_note intentionally absent
          },
          default_price: { unit_amount: 1000 },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const starter = data.credits.find((b: { name: string }) => b.name === 'Starter');
    expect(starter.priceNote).toBe('one-time');
  });

  it('defaults perpetual revealui_renewal to empty string when metadata is absent', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Pro Perpetual',
          metadata: {
            revealui_track: 'perpetual',
            revealui_tier: 'pro-perpetual',
            revealui_price_note: 'one-time',
            // revealui_renewal intentionally absent
          },
          default_price: { unit_amount: 29900 },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual');
    expect(proPerpetual.renewal).toBe('');
  });

  it('falls back when product has null default_price', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Max',
          metadata: { revealui_track: 'subscription', revealui_tier: 'max' },
          default_price: null, // no default price configured in Stripe
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const max = data.subscriptions.find((t: { id: string }) => t.id === 'max');
    expect(max.price).toBe('$149'); // static fallback
  });

  it('ignores products with an unknown revealui_track value', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Widget',
          metadata: { revealui_track: 'merch', revealui_tier: 'widget' }, // unknown track
          default_price: { unit_amount: 2500 },
        },
        {
          name: 'Enterprise',
          metadata: { revealui_track: 'subscription', revealui_tier: 'enterprise' },
          default_price: { unit_amount: 29900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    // Enterprise should be enriched; Widget (unknown track) silently ignored
    const enterprise = data.subscriptions.find((t: { id: string }) => t.id === 'enterprise');
    expect(enterprise.price).toBe('$299');
    // Subscriptions should still return 4 tiers
    expect(data.subscriptions).toHaveLength(4);
  });
});

describe('GET /api/pricing — logger call verification', () => {
  it('calls logger.warn when circuit breaker is open', async () => {
    circuitBreakerShouldThrow = true;

    const res = await freshApp.request('/');
    expect(res.status).toBe(200); // graceful fallback

    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('circuit breaker open'));
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('calls logger.error when Stripe products.list throws a network error', async () => {
    const networkErr = new Error('ECONNREFUSED: Stripe unreachable');
    mockProductsList.mockRejectedValue(networkErr);

    const res = await freshApp.request('/');
    expect(res.status).toBe(200); // graceful fallback

    expect(mockLoggerError).toHaveBeenCalledOnce();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('fetch failed'),
      expect.any(Error),
    );
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('wraps non-Error thrown by Stripe in a new Error for logger.error', async () => {
    mockProductsList.mockRejectedValue('string-error');

    await freshApp.request('/');

    const loggedError = mockLoggerError.mock.calls[0]?.[1] as Error;
    expect(loggedError).toBeInstanceOf(Error);
    expect(loggedError.message).toBe('string-error');
  });
});

describe('GET /api/pricing — formatPrice edge values', () => {
  it('formats large unit amounts correctly ($29900 → $299)', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Enterprise',
          metadata: { revealui_track: 'subscription', revealui_tier: 'enterprise' },
          default_price: { unit_amount: 29900, recurring: { interval: 'month' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const enterprise = data.subscriptions.find((t: { id: string }) => t.id === 'enterprise');
    expect(enterprise.price).toBe('$299');
    expect(enterprise.period).toBe('/month');
  });

  it('formats period as /year for annually-billed subscriptions', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Pro',
          metadata: { revealui_track: 'subscription', revealui_tier: 'pro' },
          default_price: { unit_amount: 47900, recurring: { interval: 'year' } },
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro');
    expect(pro.period).toBe('/year');
  });

  it('omits period when recurring interval is absent (one-time product)', async () => {
    mockProductsList.mockResolvedValue({
      data: [
        {
          name: 'Starter',
          metadata: { revealui_track: 'credit', revealui_tier: 'starter' },
          default_price: { unit_amount: 1000 }, // no recurring
        },
      ],
    });

    const res = await freshApp.request('/');
    const data = await res.json();

    const starter = data.credits.find((b: { name: string }) => b.name === 'Starter');
    // period is not set on credit bundles — no period field expected
    expect(starter).not.toHaveProperty('period');
  });
});
