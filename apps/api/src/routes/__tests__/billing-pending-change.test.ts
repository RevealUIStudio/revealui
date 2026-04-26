/**
 * Billing pending_change mutex route tests (R5-H10)
 *
 * Closes Surface 7 / Gap B (GAP-124): the `pending_change` 409 mutex on
 * POST /upgrade and POST /downgrade had ZERO route-level test coverage
 * prior to this file. The in-memory mock in
 * `apps/api/src/__tests__/concurrency/billing-races.test.ts:304-379` does
 * NOT exercise the real route's metadata-check path  -  it tests a separate
 * fake subscription manager.
 *
 * Coverage:
 * - Single plan-change request → 200 success (no pending_change set)
 * - Concurrent plan-change requests for the SAME customer → second returns
 *   409 with the "subscription change is already in progress" reason
 * - Concurrent plan-changes for DIFFERENT customers → both succeed (mutex
 *   is per-customer / per-subscription, not global)
 * - All three mirrored across upgrade direction + downgrade direction = 6
 *
 * The mock pattern intentionally mirrors `billing.test.ts` and
 * `billing-comprehensive.test.ts`  -  thenable Drizzle select chain, vi.hoisted
 * Stripe surface, in-memory metadata state for the subscription so the second
 * call sees the metadata the first call wrote (analogous to real Stripe-side
 * pending_change persistence between two separate webhook deliveries).
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockCustomersCreate = vi.hoisted(() => vi.fn());
const mockCheckoutSessionsCreate = vi.hoisted(() => vi.fn());
const mockBillingPortalSessionsCreate = vi.hoisted(() => vi.fn());
const mockSubscriptionsList = vi.hoisted(() => vi.fn());
const mockSubscriptionsUpdate = vi.hoisted(() => vi.fn());
const mockMeterEventsCreate = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      customers = { create: mockCustomersCreate };
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: mockBillingPortalSessionsCreate } };
      subscriptions = { list: mockSubscriptionsList, update: mockSubscriptionsUpdate };
      billing = { meterEvents: { create: mockMeterEventsCreate } };
      refunds = { create: vi.fn() };
      invoices = { list: vi.fn() };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    subscriptions: { list: mockSubscriptionsList, update: mockSubscriptionsUpdate },
    refunds: { create: vi.fn() },
    invoices: { list: vi.fn() },
  },
  getStripe: vi.fn(() => ({
    billing: { meterEvents: { create: mockMeterEventsCreate } },
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  accountMemberships: {
    accountId: 'accountMemberships.accountId',
    userId: 'accountMemberships.userId',
    status: 'accountMemberships.status',
  },
  accountSubscriptions: {
    accountId: 'accountSubscriptions.accountId',
    stripeCustomerId: 'accountSubscriptions.stripeCustomerId',
  },
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    tier: 'accountEntitlements.tier',
    status: 'accountEntitlements.status',
  },
  billingCatalog: {
    stripePriceId: 'billingCatalog.stripePriceId',
    planId: 'billingCatalog.planId',
    tier: 'billingCatalog.tier',
    billingModel: 'billingCatalog.billingModel',
    active: 'billingCatalog.active',
  },
  users: {
    id: 'users.id',
    stripeCustomerId: 'users.stripeCustomerId',
    updatedAt: 'users.updatedAt',
  },
  licenses: {
    tier: 'licenses.tier',
    status: 'licenses.status',
    expiresAt: 'licenses.expiresAt',
    licenseKey: 'licenses.licenseKey',
    userId: 'licenses.userId',
    createdAt: 'licenses.createdAt',
    deletedAt: 'licenses.deletedAt',
    perpetual: 'licenses.perpetual',
    subscriptionId: 'licenses.subscriptionId',
    supportExpiresAt: 'licenses.supportExpiresAt',
    id: 'licenses.id',
  },
  agentTaskUsage: {
    userId: 'agentTaskUsage.userId',
    overage: 'agentTaskUsage.overage',
    count: 'agentTaskUsage.count',
    cycleStart: 'agentTaskUsage.cycleStart',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  desc: vi.fn((_col) => `desc(${String(_col)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  gt: vi.fn((_col, _val) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col, _val) => `gte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col, _val) => `lt(${String(_col)},${String(_val)})`),
  lte: vi.fn((_col, _val) => `lte(${String(_col)},${String(_val)})`),
  isNull: vi.fn((_col) => `isNull(${String(_col)})`),
  ne: vi.fn((_col, _val) => `ne(${String(_col)},${String(_val)})`),
  count: vi.fn(() => 'count()'),
  countDistinct: vi.fn((_col) => `countDistinct(${String(_col)})`),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => `sql(${args.join(',')})`),
    {
      join: vi.fn((...args: unknown[]) => `sql.join(${args.join(',')})`),
    },
  ),
}));

// ─── DB Mock  -  thenable fluent chain ─────────────────────────────────────────
//
// Mirrors the pattern used by billing.test.ts so the mocked queries route
// through the same stub object regardless of chain depth.

let _selectResult: unknown[] = [];
let _selectQueue: unknown[][] = [];

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  then(
    onFulfilled?: (value: unknown[]) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ): Promise<unknown> {
    return Promise.resolve(_selectResult).then(onFulfilled, onRejected);
  },
  catch(onRejected: (reason: unknown) => unknown) {
    return Promise.resolve(_selectResult).catch(onRejected);
  },
};

const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };

const mockDb = { select: vi.fn(), update: vi.fn(), transaction: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  getRestPool: vi.fn(() => null),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: mockLogger,
  createLogger: () => mockLogger,
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import billingApp from '../billing.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const MOCK_USER: UserContext = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
};

function createApp(user: UserContext = MOCK_USER) {
  const app = new Hono<{
    Variables: {
      user: UserContext | undefined;
      entitlements?:
        | {
            accountId?: string | null;
            subscriptionStatus?: string | null;
            tier?: 'free' | 'pro' | 'max' | 'enterprise';
            limits?: { maxAgentTasks?: number };
          }
        | undefined;
    };
  }>();
  app.use('*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/', billingApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function resetChains() {
  _selectResult = [];
  _selectQueue = [];
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.innerJoin.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockImplementation(() => Promise.resolve(_selectResult));
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDb.select.mockImplementation(() => {
    if (_selectQueue.length > 0) {
      _selectResult = _selectQueue.shift() ?? [];
    }
    return mockDbSelectChain;
  });
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
  mockSubscriptionsList.mockResolvedValue({ data: [] });
  mockSubscriptionsUpdate.mockResolvedValue({});
}

function queueSelectResults(...results: unknown[][]) {
  _selectQueue = [...results];
}

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Build a mock subscription whose `metadata` is a live reference shared
 * across `subscriptions.list` and `subscriptions.update`. Mutating `metadata`
 * after a call models Stripe-side persistence: the next list response sees
 * the metadata that the previous update wrote, exactly as a second concurrent
 * route handler would observe it on a real Stripe account.
 */
function makeStripeSubscription(opts: {
  id: string;
  itemId?: string;
  metadata?: Record<string, string>;
}) {
  return {
    id: opts.id,
    status: 'active',
    items: { data: [{ id: opts.itemId ?? `si_${opts.id}` }] },
    metadata: { ...(opts.metadata ?? {}) },
    cancel_at: null,
    cancel_at_period_end: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /upgrade  -  pending_change mutex (R5-H10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    process.env.STRIPE_MAX_PRICE_ID = 'price_max_server';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_server';
  });

  it('single plan-change request returns 200 success when no pending_change is set', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_solo' }],
    );
    const subscription = makeStripeSubscription({ id: 'sub_solo' });
    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });
    mockSubscriptionsUpdate.mockImplementation(
      async (_id: string, args: { metadata?: Record<string, string> }) => {
        if (args.metadata) {
          subscription.metadata = { ...subscription.metadata, ...args.metadata };
        }
        return subscription;
      },
    );

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce();
  });

  it('concurrent upgrade requests for the SAME customer  -  second returns 409 with pending_change reason', async () => {
    queueSelectResults(
      // First request select chain
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_dual' }],
      // Second request select chain
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_dual' }],
    );

    // Shared subscription state. After the first .update, the metadata
    // contains pending_change/pending_change_at; the second .list returns
    // the same object with that metadata populated  -  same pattern Stripe
    // exhibits on a real second concurrent webhook delivery.
    const subscription = makeStripeSubscription({ id: 'sub_dual' });
    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });
    mockSubscriptionsUpdate.mockImplementation(
      async (_id: string, args: { metadata?: Record<string, string> }) => {
        if (args.metadata) {
          subscription.metadata = { ...subscription.metadata, ...args.metadata };
        }
        return subscription;
      },
    );

    const app = createApp();

    // Request 1  -  succeeds, writes pending_change into Stripe metadata
    const res1 = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );
    expect(res1.status).toBe(200);
    expect(subscription.metadata.pending_change).toBe('upgrade:enterprise');
    expect(subscription.metadata.pending_change_at).toBeDefined();

    // Request 2  -  sees pending_change in metadata, returns 409
    const res2 = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect(body2.error as string).toContain('subscription change is already in progress');
    // Only ONE Stripe.subscriptions.update call  -  the second never reached the API
    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce();
  });

  it('concurrent upgrade requests for DIFFERENT customers both succeed (mutex is per-customer)', async () => {
    // First select chain → customer A; second select chain → customer B
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_alice' }],
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_bob' }],
    );

    const subAlice = makeStripeSubscription({ id: 'sub_alice' });
    const subBob = makeStripeSubscription({ id: 'sub_bob' });

    // Stripe.subscriptions.list returns the matching customer's subscription.
    // Each list call sees fresh metadata for that customer; mutex on Alice's
    // subscription must not affect Bob's.
    mockSubscriptionsList.mockImplementation(async (args: { customer: string }) => {
      if (args.customer === 'cus_alice') return { data: [subAlice] };
      if (args.customer === 'cus_bob') return { data: [subBob] };
      return { data: [] };
    });

    mockSubscriptionsUpdate.mockImplementation(
      async (id: string, args: { metadata?: Record<string, string> }) => {
        const target = id === 'sub_alice' ? subAlice : subBob;
        if (args.metadata) {
          target.metadata = { ...target.metadata, ...args.metadata };
        }
        return target;
      },
    );

    const aliceUser: UserContext = {
      id: 'user-alice',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'admin',
    };
    const bobUser: UserContext = {
      id: 'user-bob',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'admin',
    };

    const aliceApp = createApp(aliceUser);
    const bobApp = createApp(bobUser);

    // Alice upgrades  -  pending_change written on sub_alice
    const aliceRes = await aliceApp.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );
    expect(aliceRes.status).toBe(200);
    expect(subAlice.metadata.pending_change).toBe('upgrade:enterprise');
    // Bob's subscription metadata remains untouched (mutex is per-customer)
    expect(subBob.metadata.pending_change).toBeUndefined();

    // Bob upgrades  -  succeeds because his subscription has no pending_change
    const bobRes = await bobApp.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );
    expect(bobRes.status).toBe(200);
    expect(subBob.metadata.pending_change).toBe('upgrade:enterprise');

    // Both .update calls reached Stripe (the mutex did NOT cross-block customers)
    expect(mockSubscriptionsUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('POST /downgrade  -  pending_change mutex (R5-H10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
  });

  it('single plan-change request returns 200 success when no pending_change is set', async () => {
    _selectResult = [{ stripeCustomerId: 'cus_solo' }];
    const subscription = makeStripeSubscription({ id: 'sub_solo' });
    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });
    mockSubscriptionsUpdate.mockImplementation(
      async (_id: string, args: { metadata?: Record<string, string> }) => {
        if (args.metadata) {
          subscription.metadata = { ...subscription.metadata, ...args.metadata };
        }
        return { ...subscription, cancel_at: null };
      },
    );

    const app = createApp();
    const res = await app.request(post('/downgrade', {}));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce();
  });

  it('concurrent downgrade requests for the SAME customer  -  second returns 409 with pending_change reason', async () => {
    // Both downgrade calls go through resolveHostedStripeCustomerId → same
    // queued select results for both requests.
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      _selectResult = [{ stripeCustomerId: 'cus_dual' }];
      return mockDbSelectChain;
    });

    const subscription = makeStripeSubscription({ id: 'sub_dual' });
    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });
    mockSubscriptionsUpdate.mockImplementation(
      async (_id: string, args: { metadata?: Record<string, string> }) => {
        if (args.metadata) {
          subscription.metadata = { ...subscription.metadata, ...args.metadata };
        }
        return { ...subscription, cancel_at: null };
      },
    );

    const app = createApp();

    const res1 = await app.request(post('/downgrade', {}));
    expect(res1.status).toBe(200);
    expect(subscription.metadata.pending_change).toBe('downgrade:free');
    expect(subscription.metadata.pending_change_at).toBeDefined();

    const res2 = await app.request(post('/downgrade', {}));
    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect(body2.error as string).toContain('subscription change is already in progress');

    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce();
    expect(selectCallCount).toBeGreaterThan(0);
  });

  it('concurrent downgrade requests for DIFFERENT customers both succeed (mutex is per-customer)', async () => {
    // Alice's request reads cus_alice; Bob's request reads cus_bob.
    // Each downgrade call goes through resolveHostedStripeCustomerId which
    // performs 2 selects (membership lookup + users.stripeCustomerId fallback).
    // We toggle Alice → Bob on every 2nd select so each user sees the right
    // customer end-to-end.
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      _selectResult =
        selectCallCount <= 2
          ? [{ stripeCustomerId: 'cus_alice' }]
          : [{ stripeCustomerId: 'cus_bob' }];
      return mockDbSelectChain;
    });

    const subAlice = makeStripeSubscription({ id: 'sub_alice' });
    const subBob = makeStripeSubscription({ id: 'sub_bob' });

    mockSubscriptionsList.mockImplementation(async (args: { customer: string }) => {
      if (args.customer === 'cus_alice') return { data: [subAlice] };
      if (args.customer === 'cus_bob') return { data: [subBob] };
      return { data: [] };
    });

    mockSubscriptionsUpdate.mockImplementation(
      async (id: string, args: { metadata?: Record<string, string> }) => {
        const target = id === 'sub_alice' ? subAlice : subBob;
        if (args.metadata) {
          target.metadata = { ...target.metadata, ...args.metadata };
        }
        return { ...target, cancel_at: null };
      },
    );

    const aliceUser: UserContext = {
      id: 'user-alice',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'admin',
    };
    const bobUser: UserContext = {
      id: 'user-bob',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'admin',
    };

    const aliceRes = await createApp(aliceUser).request(post('/downgrade', {}));
    expect(aliceRes.status).toBe(200);
    expect(subAlice.metadata.pending_change).toBe('downgrade:free');
    expect(subBob.metadata.pending_change).toBeUndefined();

    const bobRes = await createApp(bobUser).request(post('/downgrade', {}));
    expect(bobRes.status).toBe(200);
    expect(subBob.metadata.pending_change).toBe('downgrade:free');

    expect(mockSubscriptionsUpdate).toHaveBeenCalledTimes(2);
  });
});
