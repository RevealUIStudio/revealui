/**
 * Metered Overage Checkout Tests
 *
 * Verifies that STRIPE_AGENT_OVERAGE_PRICE_ID is conditionally appended to
 * /checkout line_items for Pro/Max tiers and omitted for Enterprise and when
 * the env var is unset.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockCustomersCreate = vi.hoisted(() => vi.fn());
const mockCustomersRetrieve = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'cus_existing', object: 'customer' }),
);
const mockCheckoutSessionsCreate = vi.hoisted(() => vi.fn());
const mockSubscriptionsList = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      customers = { create: mockCustomersCreate, retrieve: mockCustomersRetrieve };
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: vi.fn() } };
      subscriptions = { list: mockSubscriptionsList, update: vi.fn() };
      billing = { meterEvents: { create: vi.fn() } };
      refunds = { create: vi.fn() };
      invoices = { list: vi.fn() };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    customers: { create: mockCustomersCreate, retrieve: mockCustomersRetrieve },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: mockSubscriptionsList, update: vi.fn() },
    refunds: { create: vi.fn() },
    invoices: { list: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
  },
  getStripe: vi.fn(() => ({
    billing: { meterEvents: { create: vi.fn() } },
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
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
  desc: vi.fn((_col: unknown) => `desc(${String(_col)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  gt: vi.fn((_col: unknown, _val: unknown) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col: unknown, _val: unknown) => `gte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col: unknown, _val: unknown) => `lt(${String(_col)},${String(_val)})`),
  lte: vi.fn((_col: unknown, _val: unknown) => `lte(${String(_col)},${String(_val)})`),
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

// ─── DB mock — thenable fluent chain ──────────────────────────────────────────

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

// ─── Import under test (after mocks) ──────────────────────────────────────────

import billingApp from '../billing.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const MOCK_USER: UserContext = {
  id: 'user-metered',
  email: 'metered@example.com',
  name: 'Metered User',
  role: 'admin',
};

function createApp(user: UserContext = MOCK_USER) {
  const app = new Hono<{ Variables: { user: UserContext | undefined } }>();
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /checkout — metered overage price attachment', () => {
  const OVERAGE_PRICE_ID = 'price_overage_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.ADMIN_URL = 'https://app.example.com';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_test';
    process.env.STRIPE_MAX_PRICE_ID = 'price_max_test';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_test';
    process.env.STRIPE_AGENT_OVERAGE_PRICE_ID = OVERAGE_PRICE_ID;
  });

  afterEach(() => {
    delete process.env.STRIPE_AGENT_OVERAGE_PRICE_ID;
  });

  it('appends metered item as second line_item for pro tier', async () => {
    queueSelectResults([{ stripePriceId: 'price_pro_test' }], [{ stripeCustomerId: 'cus_pro' }]);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/pro' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'pro' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0]).toEqual({ price: 'price_pro_test', quantity: 1 });
    expect(lineItems[1]).toEqual({ price: OVERAGE_PRICE_ID });
  });

  it('appends metered item as second line_item for max tier', async () => {
    queueSelectResults([{ stripePriceId: 'price_max_test' }], [{ stripeCustomerId: 'cus_max' }]);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/max' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'max' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0]).toEqual({ price: 'price_max_test', quantity: 1 });
    expect(lineItems[1]).toEqual({ price: OVERAGE_PRICE_ID });
  });

  it('metered item has no quantity field (Stripe rejects metered items with quantity)', async () => {
    queueSelectResults([{ stripePriceId: 'price_pro_test' }], [{ stripeCustomerId: 'cus_pro' }]);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/pro' });

    const app = createApp();
    await app.request(post('/checkout', { tier: 'pro' }));

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;
    const meteredItem = lineItems[1];

    expect(meteredItem).not.toHaveProperty('quantity');
  });

  it('omits metered item for enterprise tier (unlimited — no overage billing)', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_test' }],
      [{ stripeCustomerId: 'cus_ent' }],
    );
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/ent' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'enterprise' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;

    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toEqual({ price: 'price_enterprise_test', quantity: 1 });
  });

  it('omits metered item when STRIPE_AGENT_OVERAGE_PRICE_ID is unset (graceful degradation)', async () => {
    delete process.env.STRIPE_AGENT_OVERAGE_PRICE_ID;

    queueSelectResults([{ stripePriceId: 'price_pro_test' }], [{ stripeCustomerId: 'cus_pro' }]);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/pro' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'pro' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;

    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toEqual({ price: 'price_pro_test', quantity: 1 });
  });
});

describe('POST /checkout — session metadata (license-issuance contract)', () => {
  // The webhook resolves the paid tier via resolveTier(session.metadata) in
  // webhooks.ts. Stripe does NOT copy subscription_data.metadata onto the
  // Checkout Session, so the subscription checkout MUST set metadata.tier at the
  // TOP level or every completed checkout 500s and no license is issued.
  // Regression guard for the P0 found in the 2026-06-07 checkout audit — the
  // metered tests above inspect the same create args but only checked line_items.
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.ADMIN_URL = 'https://app.example.com';
  });

  it('sets top-level session metadata.tier + revealui_user_id (P0 regression)', async () => {
    queueSelectResults([{ stripePriceId: 'price_pro_test' }], [{ stripeCustomerId: 'cus_pro' }]);
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/pro' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'pro' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    // Top-level metadata is what webhooks.ts resolveTier(session.metadata) reads.
    expect(sessionArgs.metadata).toEqual({ tier: 'pro', revealui_user_id: 'user-metered' });
    // subscription_data.metadata must stay in lockstep (durable fallback source).
    const subData = sessionArgs.subscription_data as Record<string, unknown>;
    expect(subData.metadata).toEqual({ tier: 'pro', revealui_user_id: 'user-metered' });
  });

  it('top-level metadata.tier reflects the requested tier, not a hardcoded default', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_test' }],
      [{ stripeCustomerId: 'cus_ent' }],
    );
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/ent' });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'enterprise' }));
    expect(res.status).toBe(200);

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sessionArgs.metadata).toEqual({
      tier: 'enterprise',
      revealui_user_id: 'user-metered',
    });
  });
});
