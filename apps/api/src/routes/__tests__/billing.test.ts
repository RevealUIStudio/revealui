/**
 * Billing Route Tests
 *
 * Covers: POST /checkout, POST /portal, GET /subscription
 * across auth, Stripe customer creation, and DB lookup scenarios.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockMeterEventsCreate = vi.fn();
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    // Must use class — billing.ts calls `new Stripe(key)`
    class {
      customers = { create: mockCustomersCreate };
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: mockBillingPortalSessionsCreate } };
      subscriptions = { list: mockSubscriptionsList, update: mockSubscriptionsUpdate };
      billing = { meterEvents: { create: mockMeterEventsCreate } };
    } as unknown as (...args: unknown[]) => unknown,
  ),
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
}));

// ─── DB Mock — thenable fluent chain ─────────────────────────────────────────
//
// Drizzle's query builder is thenable at any chain depth.
// We need the mock to support both:
//   - `await db.select().from().where()`               (no .limit())
//   - `await db.select().from().where().orderBy().limit(1)`
//
// Making the chain object thenable (via .then()) satisfies both cases.

let _selectResult: unknown[] = [];
let _selectQueue: unknown[][] = [];

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  // Thenable — direct `await` on chain resolves to _selectResult
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mirrors Drizzle's awaitable query builder
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
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: mockLogger,
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

/**
 * Wrap billingApp with a user-injecting middleware.
 * Uses a typed Hono so c.set('user', ...) reaches the inner route handlers.
 */
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
  // Default subscription list — empty (no active subscription)
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

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.CMS_URL = 'https://app.example.com';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    process.env.STRIPE_MAX_PRICE_ID = 'price_max_server';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_server';
  });

  it('returns 401 when not authenticated', async () => {
    // billingApp.request() directly — no user ever set in context
    const res = await billingApp.request(post('/checkout', { priceId: 'price_abc' }));
    expect(res.status).toBe(401);
  });

  it('creates Stripe customer when none exists and returns checkout URL', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_pro_server' }],
      [{ stripeCustomerId: null }],
      [{ stripeCustomerId: null }],
      [{ stripeCustomerId: 'cus_new' }],
    );
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/sess_abc',
    });

    const app = createApp();
    const res = await app.request(post('/checkout', { priceId: 'price_pro_server', tier: 'pro' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.url).toBe('https://checkout.stripe.com/pay/sess_abc');

    // Should have created a new Stripe customer
    expect(mockCustomersCreate).toHaveBeenCalledOnce();
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      {
        email: MOCK_USER.email,
        metadata: { revealui_user_id: MOCK_USER.id },
      },
      {
        idempotencyKey: `create-customer-${MOCK_USER.id}`,
      },
    );

    // Should have stored the new customer ID on the user record
    expect(mockDb.update).toHaveBeenCalledOnce();

    // Should have created a checkout session with the new customer ID
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledOnce();
    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sessionArgs.customer).toBe('cus_new');
    expect(sessionArgs.mode).toBe('subscription');
  });

  it('reuses existing Stripe customer when one already exists', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_pro_server' }],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/sess_xyz',
    });

    const app = createApp();
    const res = await app.request(post('/checkout', { priceId: 'price_pro_server' }));

    expect(res.status).toBe(200);
    // Must NOT create a new Stripe customer
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    // Must use the existing customer ID
    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sessionArgs.customer).toBe('cus_existing');
  });

  it('includes tier and user ID in subscription_data metadata', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/sess_ent',
    });

    const app = createApp();
    await app.request(
      post('/checkout', { priceId: 'price_enterprise_server', tier: 'enterprise' }),
    );

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const meta = (sessionArgs.subscription_data as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >;
    expect(meta.tier).toBe('enterprise');
    expect(meta.revealui_user_id).toBe(MOCK_USER.id);
  });

  it('defaults to pro tier when tier is not specified', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_pro_server' }],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/sess_pro',
    });

    const app = createApp();
    await app.request(post('/checkout', { priceId: 'price_pro_server' }));

    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const meta = (sessionArgs.subscription_data as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >;
    expect(meta.tier).toBe('pro');
  });

  it('returns 500 when STRIPE_SECRET_KEY is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const app = createApp();
    const res = await app.request(post('/checkout', { priceId: 'price_pro_server' }));
    expect(res.status).toBe(500);
  });

  it('returns 500 when the subscription billing catalog entry is missing', async () => {
    _selectResult = [{ stripeCustomerId: 'cus_existing' }];

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'pro' }));

    expect(res.status).toBe(500);
  });

  it('prefers the drizzle billing catalog price when a matching active entry exists', async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      _selectResult =
        selectCallCount === 1
          ? [{ stripePriceId: 'price_pro_db' }]
          : [{ stripeCustomerId: 'cus_existing' }];
      return mockDbSelectChain;
    });
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/sess_catalog_db',
    });

    const app = createApp();
    const res = await app.request(post('/checkout', { tier: 'pro' }));

    expect(res.status).toBe(200);
    const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;
    expect(lineItems[0]?.price).toBe('price_pro_db');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('rejects checkout when client priceId mismatches the server catalog', async () => {
    queueSelectResults([{ stripePriceId: 'price_pro_server' }]);

    const app = createApp();
    const res = await app.request(post('/checkout', { priceId: 'price_wrong', tier: 'pro' }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain('server billing catalog');
  });
});

describe('POST /portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.CMS_URL = 'https://app.example.com';
  });

  it('returns 401 when not authenticated', async () => {
    const res = await billingApp.request(post('/portal', {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no Stripe customer', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: null }],
    );

    const app = createApp();
    const res = await app.request(post('/portal', {}));

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain('No billing account');
  });

  it('returns portal URL when Stripe customer exists', async () => {
    _selectResult = [{ stripeCustomerId: 'cus_existing' }];
    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/sess_p',
    });

    const app = createApp();
    const res = await app.request(post('/portal', {}));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.url).toBe('https://billing.stripe.com/portal/sess_p');
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'https://app.example.com/account/billing',
    });
  });

  it('prefers the hosted account subscription customer for portal access', async () => {
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      _selectResult =
        selectCallCount === 1
          ? [{ accountId: 'acct_123' }]
          : selectCallCount === 2
            ? [{ stripeCustomerId: 'cus_account' }]
            : [];
      return mockDbSelectChain;
    });
    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/sess_account',
    });

    const app = createApp();
    const res = await app.request(post('/portal', {}));

    expect(res.status).toBe(200);
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_account',
      return_url: 'https://app.example.com/account/billing',
    });
  });
});

describe('GET /subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
  });

  it('returns 401 when not authenticated', async () => {
    const res = await billingApp.request(get('/subscription'));
    expect(res.status).toBe(401);
  });

  it('returns free tier when no license record exists', async () => {
    _selectResult = []; // no license found

    const app = createApp();
    const res = await app.request(get('/subscription'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.tier).toBe('free');
    expect(body.status).toBe('active');
    expect(body.expiresAt).toBeNull();
    expect(body.licenseKey).toBeNull();
  });

  it('returns active pro license details', async () => {
    _selectResult = [
      { tier: 'pro', status: 'active', expiresAt: null, licenseKey: 'rv-license-key-test-123' },
    ];

    const app = createApp();
    const res = await app.request(get('/subscription'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.tier).toBe('pro');
    expect(body.status).toBe('active');
    expect(body.licenseKey).toBe('rv-license-key-test-123');
    expect(body.expiresAt).toBeNull();
  });

  it('returns revoked license status', async () => {
    _selectResult = [
      { tier: 'pro', status: 'revoked', expiresAt: null, licenseKey: 'rv-license-key-test-456' },
    ];

    const app = createApp();
    const res = await app.request(get('/subscription'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.tier).toBe('pro');
    expect(body.status).toBe('revoked');
  });

  it('serializes expiresAt as ISO string', async () => {
    const expiresAt = new Date('2027-01-01T00:00:00.000Z');
    _selectResult = [{ tier: 'enterprise', status: 'active', expiresAt, licenseKey: 'rv-ent-key' }];

    const app = createApp();
    const res = await app.request(get('/subscription'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('POST /upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    process.env.STRIPE_MAX_PRICE_ID = 'price_max_server';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_server';
  });

  it('returns 401 when not authenticated', async () => {
    const res = await billingApp.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no Stripe customer', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: null }],
    );

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain('No billing account');
  });

  it('returns 400 when no active subscription exists', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockSubscriptionsList.mockResolvedValue({ data: [] });

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain('No active subscription');
  });

  it('returns 400 when subscription has no items', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_empty', items: { data: [] } }],
    });

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain('no items');
  });

  it('returns success with subscriptionId on valid upgrade', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_pro', items: { data: [{ id: 'si_pro' }] } }],
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_pro' });

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.subscriptionId).toBe('sub_pro');
  });

  it('queries Stripe for the customer active subscription', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_pro', items: { data: [{ id: 'si_pro' }] } }],
    });

    const app = createApp();
    await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(mockSubscriptionsList).toHaveBeenCalledWith({
      customer: 'cus_existing',
      status: 'active',
      limit: 1,
    });
  });

  it('prefers the hosted account subscription customer for upgrades', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [{ accountId: 'acct_123' }],
      [{ stripeCustomerId: 'cus_account' }],
    );
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_pro', items: { data: [{ id: 'si_pro' }] } }],
    });

    const app = createApp();
    await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(mockSubscriptionsList).toHaveBeenCalledWith({
      customer: 'cus_account',
      status: 'active',
      limit: 1,
    });
  });

  it('updates subscription with new price, tier metadata, and prorations', async () => {
    queueSelectResults(
      [{ stripePriceId: 'price_enterprise_server' }],
      [],
      [{ stripeCustomerId: 'cus_existing' }],
    );
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_pro', items: { data: [{ id: 'si_pro' }] } }],
    });

    const app = createApp();
    await app.request(
      post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
    );

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_pro', {
      items: [{ id: 'si_pro', price: 'price_enterprise_server' }],
      metadata: { tier: 'enterprise', revealui_user_id: MOCK_USER.id },
      proration_behavior: 'create_prorations',
    });
  });

  it('rejects upgrade when client priceId mismatches the server catalog', async () => {
    queueSelectResults([{ stripePriceId: 'price_enterprise_server' }]);

    const app = createApp();
    const res = await app.request(
      post('/upgrade', { priceId: 'price_wrong', targetTier: 'enterprise' }),
    );

    expect(res.status).toBe(400);
  });
});

describe('POST /report-agent-overage', () => {
  const CRON_SECRET = 'test-cron-secret-abc';

  function cronPost(path: string) {
    return new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetChains();
    process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.STRIPE_AGENT_METER_EVENT_NAME;
  });

  it('returns 401 with invalid cron secret', async () => {
    const res = await billingApp.request(
      new Request('http://localhost/report-agent-overage', {
        method: 'POST',
        headers: { 'X-Cron-Secret': 'wrong-secret' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('skips silently when STRIPE_AGENT_METER_EVENT_NAME is not set', async () => {
    delete process.env.STRIPE_AGENT_METER_EVENT_NAME;

    const res = await billingApp.request(cronPost('/report-agent-overage'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reported).toBe(0);
    expect(body.skipped).toBe(0);
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
  });

  it('reports overage via meterEvents.create with correct payload', async () => {
    process.env.STRIPE_AGENT_METER_EVENT_NAME = 'agent_task_overage';
    _selectResult = [{ userId: 'user-1', overage: 42, stripeCustomerId: 'cus_abc' }];
    mockMeterEventsCreate.mockResolvedValue({ identifier: 'evt_1' });

    const res = await billingApp.request(cronPost('/report-agent-overage'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reported).toBe(1);
    expect(body.skipped).toBe(0);

    expect(mockMeterEventsCreate).toHaveBeenCalledOnce();
    expect(mockMeterEventsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: 'agent_task_overage',
        payload: {
          stripe_customer_id: 'cus_abc',
          value: '42',
        },
      }),
    );
  });

  it('skips users without stripeCustomerId', async () => {
    process.env.STRIPE_AGENT_METER_EVENT_NAME = 'agent_task_overage';
    _selectResult = [{ userId: 'user-no-stripe', overage: 10, stripeCustomerId: null }];

    const res = await billingApp.request(cronPost('/report-agent-overage'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reported).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
  });

  it('handles meter event creation failure gracefully', async () => {
    process.env.STRIPE_AGENT_METER_EVENT_NAME = 'agent_task_overage';
    _selectResult = [{ userId: 'user-1', overage: 5, stripeCustomerId: 'cus_fail' }];
    mockMeterEventsCreate.mockRejectedValue(new Error('Stripe error'));

    const res = await billingApp.request(cronPost('/report-agent-overage'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reported).toBe(0);
    expect(body.skipped).toBe(1);
  });
});
