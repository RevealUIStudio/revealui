/**
 * A.1 — Upgrade flow explicit item resolution (P0 fix)
 *
 * Verifies that the upgrade route resolves flat-tier and meter items by price ID
 * (not by array index), correctly handles Pro→Max, Pro→Enterprise, and Max→Pro
 * upgrade scenarios with respect to the metered overage line item.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockSubscriptionsList = vi.hoisted(() => vi.fn());
const mockSubscriptionsUpdate = vi.hoisted(() => vi.fn());
const mockPricesRetrieve = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'price_overage', active: true }),
);
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      customers = { create: vi.fn() };
      prices = { retrieve: mockPricesRetrieve };
      checkout = { sessions: { create: vi.fn() } };
      billingPortal = { sessions: { create: vi.fn() } };
      subscriptions = { list: mockSubscriptionsList, update: mockSubscriptionsUpdate };
      billing = { meterEvents: { create: vi.fn() } };
      refunds = { create: vi.fn() };
      invoices = { list: vi.fn() };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    customers: { create: vi.fn() },
    prices: { retrieve: mockPricesRetrieve },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: mockSubscriptionsList, update: mockSubscriptionsUpdate },
    refunds: { create: vi.fn() },
    invoices: { list: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
  },
  getStripe: vi.fn(),
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
    email: 'users.email',
    stripeCustomerId: 'users.stripeCustomerId',
    updatedAt: 'users.updatedAt',
  },
  licenses: {
    id: 'licenses.id',
    tier: 'licenses.tier',
    status: 'licenses.status',
    expiresAt: 'licenses.expiresAt',
    licenseKey: 'licenses.licenseKey',
    userId: 'licenses.userId',
    createdAt: 'licenses.createdAt',
    perpetual: 'licenses.perpetual',
    supportExpiresAt: 'licenses.supportExpiresAt',
    deletedAt: 'licenses.deletedAt',
    subscriptionId: 'licenses.subscriptionId',
    customerId: 'licenses.customerId',
  },
  agentCreditBalance: {
    userId: 'agentCreditBalance.userId',
    balance: 'agentCreditBalance.balance',
    totalPurchased: 'agentCreditBalance.totalPurchased',
  },
  agentTaskUsage: {
    userId: 'agentTaskUsage.userId',
    overage: 'agentTaskUsage.overage',
    count: 'agentTaskUsage.count',
    cycleStart: 'agentTaskUsage.cycleStart',
  },
  processedWebhookEvents: {
    eventId: 'processedWebhookEvents.eventId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
  desc: vi.fn((_col: unknown) => `desc(${String(_col)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  gt: vi.fn((_col: unknown, _val: unknown) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col: unknown, _val: unknown) => `gte(${String(_col)},${String(_val)})`),
  lte: vi.fn((_col: unknown, _val: unknown) => `lte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col: unknown, _val: unknown) => `lt(${String(_col)},${String(_val)})`),
  isNull: vi.fn((_col: unknown) => `isNull(${String(_col)})`),
  ne: vi.fn((_col: unknown, _val: unknown) => `ne(${String(_col)},${String(_val)})`),
  count: vi.fn(() => 'count()'),
  countDistinct: vi.fn((_col: unknown) => `countDistinct(${String(_col)})`),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => `sql(${args.join(',')})`),
    {
      join: vi.fn((...args: unknown[]) => `sql.join(${args.join(',')})`),
    },
  ),
}));

vi.mock('@revealui/core/license', () => ({
  getMaxAgentTasks: vi.fn(() => 10_000),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: mockLogger,
  createLogger: () => mockLogger,
}));

// ─── DB mock — fluent chain ───────────────────────────────────────────────────

let _selectQueue: unknown[][] = [];
let _currentDequeued: unknown[] = [];

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  then: (resolve: (value: unknown[]) => unknown) => resolve(_currentDequeued),
};
(mockDbSelectChain.from as ReturnType<typeof vi.fn>).mockReturnValue(mockDbSelectChain);
(mockDbSelectChain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(mockDbSelectChain);
(mockDbSelectChain.where as ReturnType<typeof vi.fn>).mockReturnValue(mockDbSelectChain);
(mockDbSelectChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(mockDbSelectChain);

const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };
const mockDb = { select: vi.fn(), update: vi.fn(), insert: vi.fn(), transaction: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  getRestPool: vi.fn(() => null),
}));

// ─── Import under test (after mocks) ──────────────────────────────────────────

import billingApp from '../billing.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRO_PRICE_ID = 'price_pro_test';
const MAX_PRICE_ID = 'price_max_test';
const ENTERPRISE_PRICE_ID = 'price_ent_test';
const OVERAGE_PRICE_ID = 'price_overage_test';

const MOCK_USER = { id: 'user-upgrade', email: 'upgrade@example.com', name: 'U', role: 'admin' };

function createApp() {
  const app = new Hono<{
    Variables: { user: typeof MOCK_USER | undefined; entitlements: unknown };
  }>();
  app.use('*', async (c, next) => {
    c.set('user', MOCK_USER);
    c.set('entitlements', { tier: 'pro', accountId: 'acct-1' });
    await next();
  });
  app.route('/', billingApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function resetChains() {
  _selectQueue = [];
  _currentDequeued = [];
  mockDb.select.mockImplementation(() => {
    const dequeued = _selectQueue.shift() ?? [];
    _currentDequeued = dequeued;
    mockDbSelectChain.limit.mockResolvedValue(dequeued);
    return mockDbSelectChain;
  });
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.insert.mockReturnValue({
    values: vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: vi.fn().mockReturnValue({ catch: vi.fn() }) }),
  });
  mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_test' });
}

function queueSelects(...rows: unknown[][]) {
  _selectQueue = [...rows];
}

function buildSubscription(opts: {
  status?: string;
  items: Array<{ id: string; priceId: string }>;
}): Record<string, unknown> {
  return {
    id: 'sub_test',
    status: opts.status ?? 'active',
    metadata: {},
    items: {
      data: opts.items.map((i) => ({
        id: i.id,
        price: { id: i.priceId },
      })),
    },
  };
}

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /upgrade — A.1 explicit item resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.ADMIN_URL = 'https://app.example.com';
    process.env.STRIPE_AGENT_OVERAGE_PRICE_ID = OVERAGE_PRICE_ID;
  });

  afterEach(() => {
    delete process.env.STRIPE_AGENT_OVERAGE_PRICE_ID;
  });

  it('Pro→Max: swaps flat-tier price and leaves meter item unchanged (same SKU)', async () => {
    const proSubscription = buildSubscription({
      items: [
        { id: 'si_flat_pro', priceId: PRO_PRICE_ID },
        { id: 'si_meter', priceId: OVERAGE_PRICE_ID },
      ],
    });
    mockSubscriptionsList.mockResolvedValue({ data: [proSubscription] });

    queueSelects(
      [{ stripePriceId: MAX_PRICE_ID }],
      [{ stripeCustomerId: 'cus_pro' }],
      [
        { stripePriceId: PRO_PRICE_ID },
        { stripePriceId: MAX_PRICE_ID },
        { stripePriceId: ENTERPRISE_PRICE_ID },
      ],
    );

    const app = createApp();
    const res = await app.request(post('/upgrade', { targetTier: 'max' }));
    expect(res.status).toBe(200);

    const [, updateParams] = mockSubscriptionsUpdate.mock.calls[0] as [
      string,
      { items: Array<{ id?: string; price?: string; deleted?: boolean }> },
    ];
    const items = updateParams.items;

    const flatUpdate = items.find((i) => i.id === 'si_flat_pro');
    expect(flatUpdate).toBeDefined();
    expect(flatUpdate?.price).toBe(MAX_PRICE_ID);

    const meterEntry = items.find((i) => i.id === 'si_meter');
    expect(meterEntry).toBeUndefined();
    expect(items.find((i) => i.deleted)).toBeUndefined();
  });

  it('Pro→Enterprise: removes meter item (Enterprise has no metered overage)', async () => {
    const proSubscription = buildSubscription({
      items: [
        { id: 'si_flat_pro', priceId: PRO_PRICE_ID },
        { id: 'si_meter', priceId: OVERAGE_PRICE_ID },
      ],
    });
    mockSubscriptionsList.mockResolvedValue({ data: [proSubscription] });

    queueSelects(
      [{ stripePriceId: ENTERPRISE_PRICE_ID }],
      [{ stripeCustomerId: 'cus_pro' }],
      [
        { stripePriceId: PRO_PRICE_ID },
        { stripePriceId: MAX_PRICE_ID },
        { stripePriceId: ENTERPRISE_PRICE_ID },
      ],
    );

    const app = createApp();
    const res = await app.request(post('/upgrade', { targetTier: 'enterprise' }));
    expect(res.status).toBe(200);

    const [, updateParams] = mockSubscriptionsUpdate.mock.calls[0] as [
      string,
      { items: Array<{ id?: string; price?: string; deleted?: boolean }> },
    ];
    const items = updateParams.items;

    const flatUpdate = items.find((i) => i.id === 'si_flat_pro');
    expect(flatUpdate?.price).toBe(ENTERPRISE_PRICE_ID);

    const meterDelete = items.find((i) => i.id === 'si_meter' && i.deleted === true);
    expect(meterDelete).toBeDefined();
  });

  it('Max→Pro: keeps meter item (both Pro and Max have metered overage, same SKU)', async () => {
    const maxSubscription = buildSubscription({
      items: [
        { id: 'si_flat_max', priceId: MAX_PRICE_ID },
        { id: 'si_meter', priceId: OVERAGE_PRICE_ID },
      ],
    });
    mockSubscriptionsList.mockResolvedValue({ data: [maxSubscription] });

    queueSelects(
      [{ stripePriceId: ENTERPRISE_PRICE_ID }],
      [{ stripeCustomerId: 'cus_max' }],
      [
        { stripePriceId: PRO_PRICE_ID },
        { stripePriceId: MAX_PRICE_ID },
        { stripePriceId: ENTERPRISE_PRICE_ID },
      ],
    );

    const app = createApp();
    app.use('*', async (c, next) => {
      c.set('entitlements', { tier: 'max', accountId: 'acct-1' });
      await next();
    });

    const res = await app.request(post('/upgrade', { targetTier: 'enterprise' }));
    expect(res.status).toBe(200);

    const [, updateParams] = mockSubscriptionsUpdate.mock.calls[0] as [
      string,
      { items: Array<{ id?: string; price?: string; deleted?: boolean }> },
    ];
    const items = updateParams.items;

    const meterDelete = items.find((i) => i.id === 'si_meter' && i.deleted === true);
    expect(meterDelete).toBeDefined();
    expect(items.find((i) => !(i.id || i.deleted))).toBeUndefined();
  });

  it('rejects when flat-tier item cannot be found by catalog price ID', async () => {
    const unknownSubscription = buildSubscription({
      items: [{ id: 'si_unknown', priceId: 'price_unknown_xyz' }],
    });
    mockSubscriptionsList.mockResolvedValue({ data: [unknownSubscription] });

    queueSelects(
      [{ stripePriceId: MAX_PRICE_ID }],
      [{ stripeCustomerId: 'cus_pro' }],
      [{ stripePriceId: PRO_PRICE_ID }, { stripePriceId: MAX_PRICE_ID }],
    );

    const app = createApp();
    const res = await app.request(post('/upgrade', { targetTier: 'max' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain('flat-tier');
  });
});
