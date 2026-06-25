/**
 * A2: per-cold-instance live-catalog completeness gate on POST /api/billing/checkout.
 *
 * Asserts the checkout gate fails fast with a precise NAMED error when an
 * expected live price row is missing or null — the failure mode that, post-flip,
 * boots a Vercel cold instance clean and then 500s the first real checkout (the
 * boot-time validator only runs on the Fly worker). The gate and the Fly
 * validator share findBillingCatalogGaps + EXPECTED_LIVE_PLAN_IDS, so a single
 * predicate is exercised here and at startup.
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { assertLiveCatalogComplete, resetLiveCatalogGateForTests } from '../billing.js';

interface Row {
  planId: string;
  stripePriceId: string | null;
}

const EXPECTED = [
  'subscription:pro',
  'subscription:max',
  'subscription:enterprise',
  'perpetual:pro',
  'perpetual:max',
  'perpetual:enterprise',
  'credits:starter',
  'credits:standard',
  'credits:scale',
];

function completeRows(): Row[] {
  return EXPECTED.map((planId) => ({ planId, stripePriceId: `price_live_${planId}` }));
}

/** Run the gate and return the thrown HTTPException, or fail if it did not throw. */
async function catchGate(promise: Promise<void>): Promise<HTTPException> {
  try {
    await promise;
  } catch (e) {
    return e as HTTPException;
  }
  throw new Error('expected assertLiveCatalogComplete to throw, but it resolved');
}

describe('assertLiveCatalogComplete (A2 checkout gate)', () => {
  beforeEach(() => resetLiveCatalogGateForTests());

  it('throws a named 503 naming a null live price row', async () => {
    const rows = completeRows().map((r) =>
      r.planId === 'subscription:max' ? { ...r, stripePriceId: null } : r,
    );
    const err = await catchGate(assertLiveCatalogComplete('live', async () => rows));
    expect(err).toBeInstanceOf(HTTPException);
    expect(err.status).toBe(503);
    expect(err.message).toContain('Billing catalog incomplete');
    expect(err.message).toContain('null stripe_price_id');
    expect(err.message).toContain('subscription:max');
  });

  it('throws naming a missing plan row', async () => {
    const rows = completeRows().filter((r) => r.planId !== 'credits:scale');
    const err = await catchGate(assertLiveCatalogComplete('live', async () => rows));
    expect(err.status).toBe(503);
    expect(err.message).toContain('missing rows');
    expect(err.message).toContain('credits:scale');
  });

  it('resolves when every expected live plan has a non-null price', async () => {
    await expect(
      assertLiveCatalogComplete('live', async () => completeRows()),
    ).resolves.toBeUndefined();
  });

  it('caches success: a later incomplete catalog is not re-fetched once verified', async () => {
    await assertLiveCatalogComplete('live', async () => completeRows());
    // Even a now-broken catalog + a fetcher that would throw is short-circuited.
    const throwingFetch = vi.fn(async (): Promise<Row[]> => {
      throw new Error('fetcher must not be called after success is cached');
    });
    await expect(assertLiveCatalogComplete('live', throwingFetch)).resolves.toBeUndefined();
    expect(throwingFetch).not.toHaveBeenCalled();
  });

  it('is a no-op in test mode even when the catalog is incomplete', async () => {
    const incomplete = async (): Promise<Row[]> => [
      { planId: 'subscription:pro', stripePriceId: null },
    ];
    await expect(assertLiveCatalogComplete('test', incomplete)).resolves.toBeUndefined();
  });
});
