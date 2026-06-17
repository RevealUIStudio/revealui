import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vitest hoists vi.mock; mock factories must reference hoisted).
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  getClientMock: vi.fn(),
  subscriptionsListMock: vi.fn(),
  sendCronFailureAlertMock: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({ logger: hoisted.logger }));

vi.mock('@revealui/db/schema', () => ({
  accountSubscriptions: {
    accountId: Symbol('accountSubscriptions.accountId'),
    stripeSubscriptionId: Symbol('accountSubscriptions.stripeSubscriptionId'),
  },
  unreconciledWebhooks: {
    eventId: Symbol('unreconciledWebhooks.eventId'),
    eventType: Symbol('unreconciledWebhooks.eventType'),
    customerId: Symbol('unreconciledWebhooks.customerId'),
    stripeObjectId: Symbol('unreconciledWebhooks.stripeObjectId'),
    objectType: Symbol('unreconciledWebhooks.objectType'),
    errorTrace: Symbol('unreconciledWebhooks.errorTrace'),
  },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => hoisted.getClientMock(),
}));

vi.mock('stripe', () => {
  class MockStripe {
    subscriptions = { list: hoisted.subscriptionsListMock };
  }
  return { default: MockStripe };
});

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    subscriptions: { list: hoisted.subscriptionsListMock },
  },
}));

vi.mock('../../lib/cron-alerts.js', () => ({
  sendCronFailureAlert: hoisted.sendCronFailureAlertMock,
}));

import reconcileApp from '../reconcile-stripe-subscriptions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SelectQueueEntry {
  table: 'accountSubscriptions' | 'unreconciledWebhooks';
  rows: unknown[];
}

/**
 * Build a db mock that handles the route's two select shapes (accountSubscriptions
 * lookup, unreconciledWebhooks idempotency check) and a single insert pipeline.
 *
 * Each call to `db.select()` consumes the next entry off `selectQueue`.
 */
function buildDbMock(opts: {
  selectQueue: SelectQueueEntry[];
  insertResolves?: boolean;
  insertRejection?: Error;
}) {
  const { selectQueue, insertResolves = true, insertRejection } = opts;

  hoisted.selectMock.mockImplementation(() => {
    const next = selectQueue.shift();
    if (!next) {
      throw new Error('selectQueue underflow — test did not arrange enough select responses');
    }
    const limitMock = vi.fn().mockResolvedValue(next.rows);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    return { from: fromMock };
  });

  if (insertRejection) {
    const valuesMock = vi.fn().mockRejectedValue(insertRejection);
    hoisted.insertMock.mockReturnValue({ values: valuesMock });
  } else if (insertResolves) {
    const valuesMock = vi.fn().mockResolvedValue({ rowCount: 1 });
    hoisted.insertMock.mockReturnValue({ values: valuesMock });
  }

  return { select: hoisted.selectMock, insert: hoisted.insertMock };
}

function makeStripeSubscription(overrides: {
  id: string;
  status: string;
  customer: string | { id: string } | null;
  created?: number;
}) {
  return {
    id: overrides.id,
    object: 'subscription' as const,
    status: overrides.status,
    customer: overrides.customer,
    created: overrides.created ?? Math.floor(Date.now() / 1000) - 60,
  };
}

function makeListResponse(subs: Array<ReturnType<typeof makeStripeSubscription>>, hasMore = false) {
  return {
    object: 'list' as const,
    data: subs,
    has_more: hasMore,
    url: '/v1/subscriptions',
  };
}

async function invoke(secret?: string) {
  return reconcileApp.fetch(
    new Request('http://localhost/reconcile-stripe-subscriptions', {
      method: 'POST',
      headers: secret ? { 'X-Cron-Secret': secret } : {},
    }),
  );
}

const GOOD_SECRET = 'test-reconcile-stripe-subscriptions-secret-xx';

function setEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.REVEALUI_CRON_SECRET = GOOD_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxxx';
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  delete process.env.REVEALUI_CRON_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.RECONCILE_STRIPE_SUBSCRIPTIONS_BATCH_SIZE;
  delete process.env.RECONCILE_STRIPE_SUBSCRIPTIONS_LOOKBACK_DAYS;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions auth', () => {
  it('returns 401 when X-Cron-Secret is missing', async () => {
    const res = await invoke();
    expect(res.status).toBe(401);
    expect(hoisted.subscriptionsListMock).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Cron-Secret is wrong length (timingSafeEqual guard)', async () => {
    const res = await invoke('short');
    expect(res.status).toBe(401);
    expect(hoisted.subscriptionsListMock).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Cron-Secret value mismatches', async () => {
    const res = await invoke('x'.repeat(GOOD_SECRET.length));
    expect(res.status).toBe(401);
    expect(hoisted.subscriptionsListMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Env gating
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions env gating', () => {
  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    setEnv({ STRIPE_SECRET_KEY: undefined });
    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(503);
    expect(hoisted.subscriptionsListMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Empty Stripe response
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions empty Stripe response', () => {
  it('returns scanned=0 and writes nothing when Stripe returns no subscriptions', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([]));
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      live: number;
      orphaned: number;
      alerted: number;
    };
    expect(res.status).toBe(200);
    expect(body.scanned).toBe(0);
    expect(body.live).toBe(0);
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Orphan detection — live sub with no local row
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions orphan detection', () => {
  it('detects a live sub with no accountSubscriptions row and writes one alert row', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_orphan_1',
      status: 'trialing',
      customer: 'cus_abc',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub]));

    // accountSubscriptions miss, idempotency miss
    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'accountSubscriptions', rows: [] },
          { table: 'unreconciledWebhooks', rows: [] },
        ],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      live: number;
      orphaned: number;
      alerted: number;
      results: Array<{ subscriptionId: string; outcome: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.scanned).toBe(1);
    expect(body.live).toBe(1);
    expect(body.orphaned).toBe(1);
    expect(body.alerted).toBe(1);
    expect(body.results[0].outcome).toBe('orphan-newly-alerted');
    expect(body.results[0].subscriptionId).toBe('sub_orphan_1');

    expect(hoisted.insertMock).toHaveBeenCalledTimes(1);
    expect(hoisted.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unsynced Stripe subscription sub_orphan_1'),
      undefined,
      expect.objectContaining({ subscriptionId: 'sub_orphan_1', customerId: 'cus_abc' }),
    );
  });

  it('treats a live sub with a matching accountSubscriptions row as matched (no alert)', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_matched_1',
      status: 'active',
      customer: 'cus_matched',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub]));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [{ table: 'accountSubscriptions', rows: [{ accountId: 'acct_local_1' }] }],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      orphaned: number;
      alerted: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(body.results[0].outcome).toBe('matched');
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });

  it('skips a non-live (canceled) subscription — no lookup, no insert', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_canceled_1',
      status: 'canceled',
      customer: 'cus_abc',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub]));
    // Empty selectQueue — no lookups should fire
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      live: number;
      orphaned: number;
      alerted: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.scanned).toBe(1);
    expect(body.live).toBe(0);
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(body.results[0].outcome).toBe('skipped-not-live');
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions idempotency', () => {
  it('does not write a second alert when the orphan already has an unreconciled row', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_orphan_known',
      status: 'active',
      customer: 'cus_known',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub]));

    // accountSubscriptions miss, idempotency HIT
    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'accountSubscriptions', rows: [] },
          {
            table: 'unreconciledWebhooks',
            rows: [{ eventId: 'cron-sub-orphan:sub_orphan_known' }],
          },
        ],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      orphaned: number;
      alerted: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.orphaned).toBe(1);
    expect(body.alerted).toBe(0);
    expect(body.results[0].outcome).toBe('orphan-already-tracked');
    expect(hoisted.insertMock).not.toHaveBeenCalled();
    expect(hoisted.logger.error).not.toHaveBeenCalled();
  });

  it('treats a primary-key conflict on insert as already-tracked (multi-region race)', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_orphan_race',
      status: 'trialing',
      customer: 'cus_race',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub]));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'accountSubscriptions', rows: [] },
          // idempotency MISS — but insert will race
          { table: 'unreconciledWebhooks', rows: [] },
        ],
        insertRejection: new Error('duplicate key value violates unique constraint'),
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      orphaned: number;
      alerted: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.orphaned).toBe(1);
    expect(body.alerted).toBe(0);
    expect(body.results[0].outcome).toBe('orphan-already-tracked');
    expect(hoisted.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('raced for sub_orphan_race'),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Pagination bound
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions pagination bound', () => {
  it('logs WARN when Stripe reports has_more (deeper backlog than batch)', async () => {
    const sub = makeStripeSubscription({
      id: 'sub_p1',
      status: 'active',
      customer: 'cus_p1',
    });
    hoisted.subscriptionsListMock.mockResolvedValueOnce(makeListResponse([sub], true));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [{ table: 'accountSubscriptions', rows: [{ accountId: 'acct_p1' }] }],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as { scanned: number; hasMore: boolean };
    expect(body.scanned).toBe(1);
    expect(body.hasMore).toBe(true);
    expect(hoisted.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stripe pagination indicates more subscriptions'),
      expect.objectContaining({ scanned: 1 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Stripe error handling
// ---------------------------------------------------------------------------
describe('reconcile-stripe-subscriptions Stripe error handling', () => {
  it('returns 502 when stripe.subscriptions.list throws', async () => {
    hoisted.subscriptionsListMock.mockRejectedValueOnce(new Error('Stripe is down'));
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));

    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; detail: string };
    expect(body.error).toBe('stripe-error');
    expect(body.detail).toContain('Stripe is down');
    expect(hoisted.logger.error).toHaveBeenCalled();
  });
});
