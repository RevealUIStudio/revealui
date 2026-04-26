import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vitest hoists vi.mock; mock factories must reference hoisted).
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  getClientMock: vi.fn(),
  customersListMock: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({ logger: hoisted.logger }));

vi.mock('@revealui/db/schema', () => ({
  users: {
    id: Symbol('users.id'),
    stripeCustomerId: Symbol('users.stripeCustomerId'),
  },
  accountSubscriptions: {
    accountId: Symbol('accountSubscriptions.accountId'),
    stripeCustomerId: Symbol('accountSubscriptions.stripeCustomerId'),
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
    customers = { list: hoisted.customersListMock };
  }
  return { default: MockStripe };
});

import reconcileApp from '../reconcile-customers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SelectQueueEntry {
  /** Marker indicating which table this select should match. */
  table: 'users' | 'accountSubscriptions' | 'unreconciledWebhooks';
  /** Rows to return from the limit() terminator. */
  rows: unknown[];
}

/**
 * Build a db mock that handles the route's three select shapes (users
 * lookup, accountSubscriptions lookup, unreconciledWebhooks idempotency
 * check) and a single insert pipeline (unreconciledWebhooks alert write).
 *
 * Each call to `db.select()` consumes the next entry off `selectQueue`.
 * That keeps test arrangement obvious — assert about queue order, not
 * about which Drizzle column symbol the route reached for first.
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

function makeStripeCustomer(overrides: {
  id: string;
  email?: string | null;
  created?: number;
  deleted?: boolean;
}) {
  return {
    id: overrides.id,
    object: 'customer' as const,
    email: overrides.email ?? null,
    created: overrides.created ?? Math.floor(Date.now() / 1000) - 60,
    deleted: overrides.deleted,
  };
}

function makeStripeListResponse(
  customers: Array<ReturnType<typeof makeStripeCustomer>>,
  hasMore = false,
) {
  return {
    object: 'list' as const,
    data: customers,
    has_more: hasMore,
    url: '/v1/customers',
  };
}

async function invoke(secret?: string) {
  return reconcileApp.fetch(
    new Request('http://localhost/reconcile-customers', {
      method: 'POST',
      headers: secret ? { 'X-Cron-Secret': secret } : {},
    }),
  );
}

const GOOD_SECRET = 'test-reconcile-customers-secret-xxxxxx';

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
  delete process.env.RECONCILE_CUSTOMERS_BATCH_SIZE;
  delete process.env.RECONCILE_CUSTOMERS_LOOKBACK_DAYS;
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('reconcile-customers auth', () => {
  it('returns 401 when X-Cron-Secret is missing', async () => {
    const res = await invoke();
    expect(res.status).toBe(401);
    expect(hoisted.customersListMock).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Cron-Secret is wrong length (timingSafeEqual guard)', async () => {
    const res = await invoke('short');
    expect(res.status).toBe(401);
    expect(hoisted.customersListMock).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Cron-Secret value mismatches', async () => {
    const res = await invoke('x'.repeat(GOOD_SECRET.length));
    expect(res.status).toBe(401);
    expect(hoisted.customersListMock).not.toHaveBeenCalled();
  });

  it('returns 200 with valid secret', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([]));
    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Env gating
// ---------------------------------------------------------------------------
describe('reconcile-customers env gating', () => {
  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    setEnv({ STRIPE_SECRET_KEY: undefined });
    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(503);
    expect(hoisted.customersListMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Empty Stripe response
// ---------------------------------------------------------------------------
describe('reconcile-customers empty Stripe response', () => {
  it('returns scanned=0 and writes nothing when Stripe returns no customers', async () => {
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([]));
    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as { scanned: number; orphaned: number; alerted: number };
    expect(res.status).toBe(200);
    expect(body.scanned).toBe(0);
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Orphan detection — single new orphan
// ---------------------------------------------------------------------------
describe('reconcile-customers orphan detection', () => {
  it('detects a single orphan and writes one alert row', async () => {
    const orphan = makeStripeCustomer({ id: 'cus_orphan_1', email: 'lost@example.com' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([orphan]));

    // Per-customer queue: users miss, subscriptions miss, idempotency miss.
    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'users', rows: [] },
          { table: 'accountSubscriptions', rows: [] },
          { table: 'unreconciledWebhooks', rows: [] },
        ],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      orphaned: number;
      alerted: number;
      results: Array<{ customerId: string; outcome: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.scanned).toBe(1);
    expect(body.orphaned).toBe(1);
    expect(body.alerted).toBe(1);
    expect(body.results[0].outcome).toBe('orphan-newly-alerted');
    expect(body.results[0].customerId).toBe('cus_orphan_1');

    // Insert called once with the synthetic event id + ORPHAN_EVENT_TYPE.
    expect(hoisted.insertMock).toHaveBeenCalledTimes(1);
    expect(hoisted.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('orphaned Stripe customer cus_orphan_1'),
      undefined,
      expect.objectContaining({ customerId: 'cus_orphan_1', email: 'lost@example.com' }),
    );
  });

  it('treats a customer with a matching users row as matched (no alert)', async () => {
    const matched = makeStripeCustomer({ id: 'cus_matched_1' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([matched]));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [{ table: 'users', rows: [{ id: 'usr_local_1' }] }],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      orphaned: number;
      alerted: number;
      results: Array<{ outcome: string }>;
    };
    expect(body.scanned).toBe(1);
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(body.results[0].outcome).toBe('matched');
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });

  it('treats a customer with a matching accountSubscriptions row as matched (no alert)', async () => {
    const matched = makeStripeCustomer({ id: 'cus_matched_via_sub' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([matched]));

    // users miss, accountSubscriptions hit
    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'users', rows: [] },
          { table: 'accountSubscriptions', rows: [{ accountId: 'acct_local_1' }] },
        ],
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

  it('mixed batch — only the orphan is flagged', async () => {
    const orphan = makeStripeCustomer({ id: 'cus_orphan_mix', email: 'lost@example.com' });
    const matched = makeStripeCustomer({ id: 'cus_matched_mix' });
    // Order matters: orphan first, matched second.
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([orphan, matched]));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          // orphan path
          { table: 'users', rows: [] },
          { table: 'accountSubscriptions', rows: [] },
          { table: 'unreconciledWebhooks', rows: [] },
          // matched path
          { table: 'users', rows: [{ id: 'usr_local_1' }] },
        ],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as {
      scanned: number;
      orphaned: number;
      alerted: number;
      results: Array<{ customerId: string; outcome: string }>;
    };
    expect(body.scanned).toBe(2);
    expect(body.orphaned).toBe(1);
    expect(body.alerted).toBe(1);
    expect(body.results.find((r) => r.customerId === 'cus_orphan_mix')?.outcome).toBe(
      'orphan-newly-alerted',
    );
    expect(body.results.find((r) => r.customerId === 'cus_matched_mix')?.outcome).toBe('matched');
    expect(hoisted.insertMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Idempotency — re-running with same orphan does NOT double-alert
// ---------------------------------------------------------------------------
describe('reconcile-customers idempotency', () => {
  it('does not write a second alert when the orphan already has an unreconciled row', async () => {
    const orphan = makeStripeCustomer({ id: 'cus_orphan_known' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([orphan]));

    // users miss, accountSubscriptions miss, idempotency HIT (already tracked).
    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'users', rows: [] },
          { table: 'accountSubscriptions', rows: [] },
          { table: 'unreconciledWebhooks', rows: [{ eventId: 'cron-orphan:cus_orphan_known' }] },
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
    expect(body.alerted).toBe(0); // already tracked → no fresh alert
    expect(body.results[0].outcome).toBe('orphan-already-tracked');
    expect(hoisted.insertMock).not.toHaveBeenCalled();
    // CRITICAL log only fires on a fresh write.
    expect(hoisted.logger.error).not.toHaveBeenCalled();
  });

  it('treats a primary-key conflict on insert as already-tracked (multi-region race)', async () => {
    const orphan = makeStripeCustomer({ id: 'cus_orphan_race' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([orphan]));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [
          { table: 'users', rows: [] },
          { table: 'accountSubscriptions', rows: [] },
          // idempotency MISS — but insert will race.
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
      expect.stringContaining('raced for cus_orphan_race'),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Pagination bound
// ---------------------------------------------------------------------------
describe('reconcile-customers pagination bound', () => {
  it('logs WARN when Stripe reports has_more (deeper backlog than batch)', async () => {
    const customer = makeStripeCustomer({ id: 'cus_p1' });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([customer], true));

    hoisted.getClientMock.mockReturnValue(
      buildDbMock({
        selectQueue: [{ table: 'users', rows: [{ id: 'usr_p1' }] }],
      }),
    );

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as { scanned: number; hasMore: boolean };
    expect(body.scanned).toBe(1);
    expect(body.hasMore).toBe(true);
    expect(hoisted.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stripe pagination indicates more customers'),
      expect.objectContaining({ scanned: 1 }),
    );
  });

  it('does not log WARN when Stripe response is fully consumed', async () => {
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([], false));
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as { hasMore: boolean };
    expect(body.hasMore).toBe(false);
    // The pagination WARN message should not appear.
    const paginationWarnCalls = hoisted.logger.warn.mock.calls.filter((args) =>
      typeof args[0] === 'string' ? args[0].includes('Stripe pagination') : false,
    );
    expect(paginationWarnCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stripe error handling
// ---------------------------------------------------------------------------
describe('reconcile-customers Stripe error handling', () => {
  it('returns 502 when stripe.customers.list throws', async () => {
    hoisted.customersListMock.mockRejectedValueOnce(new Error('Stripe is down'));
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));

    const res = await invoke(GOOD_SECRET);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; detail: string };
    expect(body.error).toBe('stripe-error');
    expect(body.detail).toContain('Stripe is down');
    expect(hoisted.logger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Deleted customers are skipped
// ---------------------------------------------------------------------------
describe('reconcile-customers deleted customers', () => {
  it('skips deleted Stripe customers — no lookup, no alert', async () => {
    const deletedCustomer = makeStripeCustomer({ id: 'cus_deleted', deleted: true });
    hoisted.customersListMock.mockResolvedValueOnce(makeStripeListResponse([deletedCustomer]));
    // Empty selectQueue — no lookups should happen.
    hoisted.getClientMock.mockReturnValue(buildDbMock({ selectQueue: [] }));

    const res = await invoke(GOOD_SECRET);
    const body = (await res.json()) as { scanned: number; orphaned: number; alerted: number };
    expect(body.scanned).toBe(1);
    expect(body.orphaned).toBe(0);
    expect(body.alerted).toBe(0);
    expect(hoisted.insertMock).not.toHaveBeenCalled();
  });
});
