/**
 * Billing Route Tests  -  Comprehensive Coverage
 *
 * Covers routes NOT tested in billing.test.ts:
 * - POST /downgrade
 * - POST /checkout-perpetual
 * - GET /usage
 * - POST /support-renewal-check
 * - Circuit breaker behavior
 * - ADMIN_URL fallback logic
 * - Stripe error propagation
 * - Concurrent customer creation
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockMeterEventsCreate = vi.fn();
const mockRefundsCreate = vi.fn();
const mockResetDbStatusCache = vi.fn();
const mockResetSupportExpiryCache = vi.fn();
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
      refunds = { create: mockRefundsCreate };
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
  lte: vi.fn((_col, _val) => `lte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col, _val) => `lt(${String(_col)},${String(_val)})`),
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

vi.mock('@revealui/core/license', () => ({
  getMaxAgentTasks: vi.fn(() => 10_000),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: (...args: unknown[]) => mockResetDbStatusCache(...args),
  resetSupportExpiryCache: (...args: unknown[]) => mockResetSupportExpiryCache(...args),
  requireFeature: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
  checkLicenseStatus: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock('@revealui/core/error-handling', async () => {
  class MockCircuitBreakerOpenError extends Error {
    constructor() {
      super('Circuit breaker is open');
      this.name = 'CircuitBreakerOpenError';
    }
  }

  return {
    CircuitBreaker: class {
      async execute(fn: () => Promise<unknown>) {
        return fn();
      }
    },
    CircuitBreakerOpenError: MockCircuitBreakerOpenError,
  };
});

const mockSendEmail = vi.fn();
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ─── DB Mock ─────────────────────────────────────────────────────────────────

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
  // Null forces ensureStripeCustomer onto the conditional-UPDATE fallback
  // path (same behavior as before #394's advisory-lock addition), which is
  // what these tests were written against.
  getRestPool: vi.fn(() => null),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: mockLogger,
  createLogger: () => mockLogger,
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import { getMaxAgentTasks } from '@revealui/core/license';
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

function createApp(
  user: UserContext = MOCK_USER,
  entitlements?: {
    accountId?: string | null;
    subscriptionStatus?: string | null;
    tier?: 'free' | 'pro' | 'max' | 'enterprise';
    limits?: { maxAgentTasks?: number };
  },
) {
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
    if (entitlements) {
      c.set('entitlements', entitlements);
    }
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

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Billing Route Tests  -  Comprehensive Coverage', { timeout: 60_000 }, () => {
  describe('POST /downgrade', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    });

    it('returns 401 when not authenticated', async () => {
      const res = await billingApp.request(post('/downgrade', {}));
      expect(res.status).toBe(401);
    });

    it('returns 400 when user has no Stripe customer', async () => {
      _selectResult = [{ stripeCustomerId: null }];

      const app = createApp();
      const res = await app.request(post('/downgrade', {}));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error as string).toContain('No billing account');
    });

    it('returns 400 when no active subscription exists', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_existing' }];
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      const app = createApp();
      const res = await app.request(post('/downgrade', {}));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error as string).toContain('No active or trialing subscription');
    });

    it('cancels subscription at period end and returns effectiveAt date', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_existing' }];
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_pro', status: 'active', items: { data: [{ id: 'si_pro' }] } }],
      });
      const cancelTimestamp = Math.floor(new Date('2026-04-15T00:00:00Z').getTime() / 1000);
      mockSubscriptionsUpdate.mockResolvedValue({
        id: 'sub_pro',
        cancel_at: cancelTimestamp,
        cancel_at_period_end: true,
      });

      const app = createApp();
      const res = await app.request(post('/downgrade', {}));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.effectiveAt).toBe(new Date(cancelTimestamp * 1000).toISOString());
    });

    it('sets cancel_at_period_end to true on Stripe subscription', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_existing' }];
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_pro', status: 'active', items: { data: [{ id: 'si_pro' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_pro', cancel_at: null });

      const app = createApp();
      await app.request(post('/downgrade', {}));

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_pro',
        {
          cancel_at_period_end: true,
          metadata: { pending_change: 'downgrade:free', pending_change_at: expect.any(String) },
        },
        { idempotencyKey: 'downgrade-sub_pro-free-user-123' },
      );
    });

    it('uses current time as effectiveAt when Stripe returns no cancel_at', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_existing' }];
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_pro', status: 'active', items: { data: [{ id: 'si_pro' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_pro', cancel_at: null });

      const before = Date.now();
      const app = createApp();
      const res = await app.request(post('/downgrade', {}));
      const after = Date.now();

      const body = (await res.json()) as Record<string, unknown>;
      const effectiveTime = new Date(body.effectiveAt as string).getTime();
      expect(effectiveTime).toBeGreaterThanOrEqual(before);
      expect(effectiveTime).toBeLessThanOrEqual(after);
    });

    it('queries Stripe for active subscription with correct customer', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_downgrade' }];
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_1', status: 'active', items: { data: [{ id: 'si_1' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1', cancel_at: null });

      const app = createApp();
      await app.request(post('/downgrade', {}));

      expect(mockSubscriptionsList).toHaveBeenCalledWith({
        customer: 'cus_downgrade',
        status: 'all',
        limit: 10,
      });
    });

    it('prefers the hosted account subscription customer for downgrades', async () => {
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
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_1', status: 'active', items: { data: [{ id: 'si_1' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1', cancel_at: null });

      const app = createApp();
      await app.request(post('/downgrade', {}));

      expect(mockSubscriptionsList).toHaveBeenCalledWith({
        customer: 'cus_account',
        status: 'all',
        limit: 10,
      });
    });

    it('prefers request-scoped account entitlements for downgrades', async () => {
      queueSelectResults([{ stripeCustomerId: 'cus_account_ctx' }]);
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_1', status: 'active', items: { data: [{ id: 'si_1' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1', cancel_at: null });

      const app = createApp(MOCK_USER, {
        accountId: 'acct_ctx',
        tier: 'pro',
        subscriptionStatus: 'active',
      });
      await app.request(post('/downgrade', {}));

      expect(mockSubscriptionsList).toHaveBeenCalledWith({
        customer: 'cus_account_ctx',
        status: 'all',
        limit: 10,
      });
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /checkout-perpetual', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.ADMIN_URL = 'https://app.example.com';
      process.env.STRIPE_PERPETUAL_PRO_PRICE_ID = 'price_pro_perpetual_server';
      process.env.STRIPE_PERPETUAL_MAX_PRICE_ID = 'price_max_perpetual_server';
      process.env.STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID = 'price_enterprise_perpetual_server';
    });

    it('returns 401 when not authenticated', async () => {
      const res = await billingApp.request(
        post('/checkout-perpetual', { priceId: 'price_perp', tier: 'pro' }),
      );
      expect(res.status).toBe(401);
    });

    it('creates a payment-mode checkout session (not subscription)', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_perp',
      });

      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.url).toBe('https://checkout.stripe.com/pay/sess_perp');

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sessionArgs.mode).toBe('payment');
      expect(sessionArgs.customer).toBe('cus_existing');
    });

    it('returns 500 when the perpetual billing catalog entry is missing', async () => {
      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error as string).toContain('Billing catalog is not configured');
    });

    it('prefers the DB billing catalog price for perpetual checkout when available', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_db' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_perp_db',
      });

      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_db', tier: 'pro' }),
      );

      expect(res.status).toBe(200);
      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      const lineItems = sessionArgs.line_items as Array<Record<string, unknown>>;
      expect(lineItems[0]?.price).toBe('price_pro_perpetual_db');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('includes perpetual and tier metadata in payment_intent_data', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_max_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_meta',
      });

      const app = createApp();
      await app.request(
        post('/checkout-perpetual', { priceId: 'price_max_perpetual_server', tier: 'max' }),
      );

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      const piMeta = (sessionArgs.payment_intent_data as Record<string, unknown>)
        .metadata as Record<string, unknown>;
      expect(piMeta.tier).toBe('max');
      expect(piMeta.perpetual).toBe('true');
      expect(piMeta.revealui_user_id).toBe(MOCK_USER.id);
    });

    it('includes github_username in metadata when provided', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_gh',
      });

      const app = createApp();
      await app.request(
        post('/checkout-perpetual', {
          priceId: 'price_pro_perpetual_server',
          tier: 'pro',
          githubUsername: 'octocat',
        }),
      );

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      const piMeta = (sessionArgs.payment_intent_data as Record<string, unknown>)
        .metadata as Record<string, unknown>;
      expect(piMeta.github_username).toBe('octocat');
    });

    it('omits github_username from metadata when not provided', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_no_gh',
      });

      const app = createApp();
      await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      const piMeta = (sessionArgs.payment_intent_data as Record<string, unknown>)
        .metadata as Record<string, unknown>;
      expect(piMeta.github_username).toBeUndefined();
    });

    it('uses perpetual success_url with perpetual=true query param', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_url',
      });

      const app = createApp();
      await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sessionArgs.success_url).toBe(
        'https://app.example.com/account/billing?perpetual=true',
      );
      expect(sessionArgs.cancel_url).toBe('https://app.example.com/account/billing');
    });

    it('returns 500 when checkout session URL is null', async () => {
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({ url: null });

      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      expect(res.status).toBe(500);
    });

    it('returns 500 when ADMIN_URL is not configured', async () => {
      delete process.env.ADMIN_URL;
      delete process.env.NEXT_PUBLIC_SERVER_URL;
      queueSelectResults(
        [], // duplicate perpetual license check
        [{ stripePriceId: 'price_pro_perpetual_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );

      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_pro_perpetual_server', tier: 'pro' }),
      );

      expect(res.status).toBe(500);
    });
  });

  describe('GET /usage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    });

    it('returns 401 when not authenticated', async () => {
      const res = await billingApp.request(get('/usage'));
      expect(res.status).toBe(401);
    });

    it('returns zero usage when no record exists for the current cycle', async () => {
      _selectResult = [];

      const app = createApp();
      const res = await app.request(get('/usage'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.used).toBe(0);
      expect(body.overage).toBe(0);
      expect(body.quota).toBe(10_000);
    });

    it('returns usage data from the current billing cycle', async () => {
      _selectResult = [{ count: 150, overage: 5 }];

      const app = createApp();
      const res = await app.request(get('/usage'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.used).toBe(150);
      expect(body.overage).toBe(5);
    });

    it('returns -1 for quota when tier has unlimited tasks', async () => {
      vi.mocked(getMaxAgentTasks).mockReturnValue(Infinity);
      _selectResult = [];

      const app = createApp();
      const res = await app.request(get('/usage'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.quota).toBe(-1);
    });

    it('prefers request-scoped entitlement quota over the legacy global quota', async () => {
      vi.mocked(getMaxAgentTasks).mockReturnValue(10_000);
      _selectResult = [];

      const app = createApp(MOCK_USER, {
        limits: { maxAgentTasks: 2_500 },
      });
      const res = await app.request(get('/usage'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.quota).toBe(2_500);
    });

    it('returns cycleStart as first of current month UTC', async () => {
      _selectResult = [];

      const app = createApp();
      const res = await app.request(get('/usage'));

      const body = (await res.json()) as Record<string, unknown>;
      const cycleStart = new Date(body.cycleStart as string);
      expect(cycleStart.getUTCDate()).toBe(1);
      expect(cycleStart.getUTCHours()).toBe(0);
      expect(cycleStart.getUTCMinutes()).toBe(0);
    });

    it('returns resetAt as first of next month UTC', async () => {
      _selectResult = [];

      const app = createApp();
      const res = await app.request(get('/usage'));

      const body = (await res.json()) as Record<string, unknown>;
      const resetAt = new Date(body.resetAt as string);
      const cycleStart = new Date(body.cycleStart as string);
      expect(resetAt.getUTCMonth()).toBe((cycleStart.getUTCMonth() + 1) % 12);
      expect(resetAt.getUTCDate()).toBe(1);
    });
  });

  describe('POST /support-renewal-check', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
      mockSendEmail.mockResolvedValue(undefined);
    });

    it('returns 403 when cron secret is missing', async () => {
      delete process.env.REVEALUI_CRON_SECRET;

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(403);
    });

    it('returns 403 when cron secret is wrong', async () => {
      const res = await billingApp.request(
        new Request('http://localhost/support-renewal-check', {
          method: 'POST',
          headers: { 'X-Cron-Secret': 'wrong-secret' },
        }),
      );
      expect(res.status).toBe(403);
    });

    it('returns 403 when X-Cron-Secret header is absent', async () => {
      const res = await billingApp.request(
        new Request('http://localhost/support-renewal-check', {
          method: 'POST',
        }),
      );
      expect(res.status).toBe(403);
    });

    it('sends reminder for license expiring within 30 days', async () => {
      const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

      // The route uses a single JOIN query: db.select({id, supportExpiresAt, email}).from(licenses).innerJoin(users, ...).where(...)
      _selectResult = [{ id: 'lic_1', supportExpiresAt: in15Days, email: 'customer@example.com' }];

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.reminded).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledOnce();
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Your RevealUI support contract expires soon',
        }),
      );
    });

    it('skips licenses without supportExpiresAt (filtered by SQL WHERE)', async () => {
      // WHERE clause (gte/lte) filters these out at DB level  -  mock returns empty
      _selectResult = [];

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.reminded).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('skips licenses that already expired (filtered by SQL WHERE)', async () => {
      // WHERE clause (gte) excludes expired licenses  -  mock returns empty
      _selectResult = [];

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.reminded).toBe(0);
    });

    it('skips licenses expiring more than 30 days out (filtered by SQL WHERE)', async () => {
      // WHERE clause (lte) excludes far-future licenses  -  mock returns empty
      _selectResult = [];

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.reminded).toBe(0);
    });

    it('continues processing even if sendEmail throws', async () => {
      const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      // Single JOIN query returns license + email together
      _selectResult = [{ id: 'lic_1', supportExpiresAt: in15Days, email: 'fail@example.com' }];
      mockSendEmail.mockRejectedValue(new Error('SMTP down'));

      const res = await billingApp.request(cronPost('/support-renewal-check'));
      expect(res.status).toBe(200);
    });
  });

  describe('ADMIN_URL fallback', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    });

    afterEach(() => {
      delete process.env.ADMIN_URL;
      delete process.env.NEXT_PUBLIC_SERVER_URL;
    });

    it('uses ADMIN_URL when both ADMIN_URL and NEXT_PUBLIC_SERVER_URL are set', async () => {
      process.env.ADMIN_URL = 'https://admin.example.com';
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://fallback.example.com';
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_url',
      });

      const app = createApp();
      await app.request(post('/checkout', { priceId: 'price_pro_server' }));

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sessionArgs.success_url).toContain('https://admin.example.com');
    });

    it('falls back to NEXT_PUBLIC_SERVER_URL when ADMIN_URL is not set', async () => {
      delete process.env.ADMIN_URL;
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://fallback.example.com';
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_url',
      });

      const app = createApp();
      await app.request(post('/checkout', { priceId: 'price_pro_server' }));

      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sessionArgs.success_url).toContain('https://fallback.example.com');
    });

    it('returns 500 when neither ADMIN_URL nor NEXT_PUBLIC_SERVER_URL is set', async () => {
      delete process.env.ADMIN_URL;
      delete process.env.NEXT_PUBLIC_SERVER_URL;
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );

      const app = createApp();
      const res = await app.request(post('/checkout', { priceId: 'price_pro_server' }));

      expect(res.status).toBe(500);
    });
  });

  describe('Stripe error propagation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.ADMIN_URL = 'https://app.example.com';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
      process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_server';
    });

    it('propagates Stripe API errors from checkout session creation', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe: card_declined'));

      const app = createApp();
      const res = await app.request(post('/checkout', { priceId: 'price_pro_server' }));

      expect(res.status).toBe(500);
    });

    it('propagates Stripe API errors from subscription update (upgrade)', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_enterprise_server' }],
        [],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_pro', status: 'active', items: { data: [{ id: 'si_pro' }] } }],
      });
      mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe: invalid_price'));

      const app = createApp();
      const res = await app.request(
        post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
      );

      expect(res.status).toBe(500);
    });

    it('propagates Stripe API errors from subscription list (downgrade)', async () => {
      _selectResult = [{ stripeCustomerId: 'cus_existing' }];
      mockSubscriptionsList.mockRejectedValue(new Error('Stripe: api_connection_error'));

      const app = createApp();
      const res = await app.request(post('/downgrade', {}));

      expect(res.status).toBe(500);
    });
  });

  describe('concurrent customer creation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.ADMIN_URL = 'https://app.example.com';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    });

    it('handles race condition where another request creates the customer first', async () => {
      // Simulate race: customer check returns null, but by the time we re-read,
      // another request already set the customer ID (conditional UPDATE was a no-op).
      // Selects: 1) price lookup, 2) customer check (null), 3) re-read (winner's ID)
      let selectCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) {
          _selectResult = [{ stripePriceId: 'price_pro_server' }];
        } else if (selectCount === 2) {
          _selectResult = [{ stripeCustomerId: null }];
        } else {
          // Re-read returns the winner's customer ID, not ours
          _selectResult = [{ stripeCustomerId: 'cus_winner' }];
        }
        return mockDbSelectChain;
      });

      mockCustomersCreate.mockResolvedValue({ id: 'cus_loser' });
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_race',
      });

      const app = createApp();
      const res = await app.request(post('/checkout', { priceId: 'price_pro_server' }));

      expect(res.status).toBe(200);
      // The checkout session should use the winner's customer ID
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledOnce();
      const sessionArgs = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(sessionArgs.customer).toBe('cus_winner');
    });
  });

  describe('checkout validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.ADMIN_URL = 'https://app.example.com';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro_server';
    });

    it('rejects checkout with empty priceId', async () => {
      const app = createApp();
      const res = await app.request(post('/checkout', { priceId: '' }));

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('accepts checkout with missing priceId when the server catalog is configured', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/sess_missing_price',
      });

      const app = createApp();
      const res = await app.request(post('/checkout', {}));

      expect(res.status).toBe(200);
    });

    it('rejects perpetual checkout with invalid tier', async () => {
      const app = createApp();
      const res = await app.request(
        post('/checkout-perpetual', { priceId: 'price_abc', tier: 'invalid_tier' }),
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('rejects upgrade with invalid targetTier', async () => {
      const app = createApp();
      const res = await app.request(
        post('/upgrade', { priceId: 'price_abc', targetTier: 'invalid' }),
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('rejects downgrade attempt via upgrade route', async () => {
      queueSelectResults([{ stripePriceId: 'price_pro_server' }]);

      const app = createApp(MOCK_USER, { tier: 'max', accountId: 'acc-1' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot downgrade');
    });

    it('rejects same-tier upgrade attempt', async () => {
      queueSelectResults([{ stripePriceId: 'price_pro_server' }]);

      const app = createApp(MOCK_USER, { tier: 'pro', accountId: 'acc-1' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot downgrade');
    });

    it('allows valid upgrade from lower to higher tier', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_enterprise_server' }],
        [],
        [{ stripeCustomerId: 'cus_existing' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_pro', status: 'active', items: { data: [{ id: 'si_pro' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({
        id: 'sub_pro',
        items: { data: [{ id: 'si_enterprise', price: { id: 'price_enterprise_server' } }] },
      });

      const app = createApp(MOCK_USER, { tier: 'pro', accountId: 'acc-1' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_enterprise_server', targetTier: 'enterprise' }),
      );

      expect(res.status).toBe(200);
    });

    // ── P1-I: trial users can upgrade out of their trial ─────────────────
    it('allows a trialing subscription to upgrade to a paid tier', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [],
        [{ stripeCustomerId: 'cus_trial' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_trial', status: 'trialing', items: { data: [{ id: 'si_trial' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({
        id: 'sub_trial',
        items: { data: [{ id: 'si_pro', price: { id: 'price_pro_server' } }] },
      });

      const app = createApp(MOCK_USER, { tier: 'free', accountId: 'acc-trial' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }),
      );

      expect(res.status).toBe(200);
      expect(mockSubscriptionsUpdate).toHaveBeenCalled();
    });

    it('uses status=all in the Stripe list query (not status=active) so trialing subs are returned', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [],
        [{ stripeCustomerId: 'cus_any' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_x', status: 'active', items: { data: [{ id: 'si_x' }] } }],
      });
      mockSubscriptionsUpdate.mockResolvedValue({
        id: 'sub_x',
        items: { data: [{ id: 'si_pro', price: { id: 'price_pro_server' } }] },
      });

      const app = createApp(MOCK_USER, { tier: 'free', accountId: 'acc-x' });
      await app.request(post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }));

      expect(mockSubscriptionsList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'all' }),
      );
    });

    it('rejects upgrade when the only subscription is canceled', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [],
        [{ stripeCustomerId: 'cus_canceled' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_gone', status: 'canceled', items: { data: [{ id: 'si_gone' }] } }],
      });

      const app = createApp(MOCK_USER, { tier: 'free', accountId: 'acc-gone' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('No active or trialing subscription');
    });

    it('rejects upgrade when the subscription is in incomplete state', async () => {
      queueSelectResults(
        [{ stripePriceId: 'price_pro_server' }],
        [],
        [{ stripeCustomerId: 'cus_inc' }],
      );
      mockSubscriptionsList.mockResolvedValue({
        data: [{ id: 'sub_inc', status: 'incomplete', items: { data: [{ id: 'si_inc' }] } }],
      });

      const app = createApp(MOCK_USER, { tier: 'free', accountId: 'acc-inc' });
      const res = await app.request(
        post('/upgrade', { priceId: 'price_pro_server', targetTier: 'pro' }),
      );

      expect(res.status).toBe(400);
    });
  });
});

// ─── POST /sweep-expired-licenses ────────────────────────────────────────────

describe('POST /sweep-expired-licenses', () => {
  beforeEach(() => {
    resetChains();
    vi.stubEnv('REVEALUI_CRON_SECRET', CRON_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockResetDbStatusCache.mockReset();
    mockResetSupportExpiryCache.mockReset();
  });

  it('returns 403 when X-Cron-Secret header is missing', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/sweep-expired-licenses', { method: 'POST' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when cron secret env var is not set', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('REVEALUI_CRON_SECRET', '');
    const app = createApp();
    const res = await app.request(cronPost('/sweep-expired-licenses'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when X-Cron-Secret does not match', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/sweep-expired-licenses', {
        method: 'POST',
        headers: { 'X-Cron-Secret': 'wrong-secret' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns { expired: 0 } and does not update DB when no licenses are expiring', async () => {
    // select returns empty (no expiring licenses)
    _selectResult = [];
    mockDb.select.mockReturnValue(mockDbSelectChain);

    const app = createApp();
    const res = await app.request(cronPost('/sweep-expired-licenses'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { expired: number };
    expect(body.expired).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockResetDbStatusCache).not.toHaveBeenCalled();
  });

  it('marks expired licenses and calls resetDbStatusCache when licenses found', async () => {
    // Phase 1 select returns two expiring license IDs; Phase 2 select returns none
    queueSelectResults([{ id: 'lic-1' }, { id: 'lic-2' }], []);
    mockDb.update.mockReturnValue(mockDbUpdateChain);

    const app = createApp();
    const res = await app.request(cronPost('/sweep-expired-licenses'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { expired: number; supportExpired: number };
    expect(body.expired).toBe(2);
    expect(body.supportExpired).toBe(0);
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockResetDbStatusCache).toHaveBeenCalledOnce();
  });
});

// ─── POST /refund ─────────────────────────────────────────────────────────────

describe('POST /refund', () => {
  beforeEach(() => {
    resetChains();
    mockRefundsCreate.mockReset();
  });

  const ADMIN_USER = { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
  const OWNER_USER = { id: 'owner-1', email: 'owner@test.com', name: 'Owner', role: 'owner' };
  const MEMBER_USER = { id: 'user-1', email: 'user@test.com', name: 'User', role: 'member' };

  it('returns 401 when not authenticated', async () => {
    const app = new Hono<{ Variables: { user: undefined; entitlements?: undefined } }>();
    app.use('*', async (c, next) => {
      c.set('user', undefined);
      await next();
    });
    app.route('/', billingApp);
    app.onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
      return c.json({ error: 'Internal server error' }, 500);
    });
    const res = await app.request(post('/refund', { paymentIntentId: 'pi_abc123' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin non-owner user', async () => {
    const app = createApp(MEMBER_USER);
    const res = await app.request(post('/refund', { paymentIntentId: 'pi_abc123' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when neither paymentIntentId nor chargeId is provided', async () => {
    const app = createApp(ADMIN_USER);
    const res = await app.request(post('/refund', {}));
    expect(res.status).toBe(400);
  });

  it('returns 200 with refund details when paymentIntentId is provided', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_abc123',
      status: 'succeeded',
      amount: 4900,
      currency: 'usd',
    });

    const app = createApp(ADMIN_USER);
    const res = await app.request(post('/refund', { paymentIntentId: 'pi_abc123', amount: 4900 }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.refundId).toBe('re_abc123');
    expect(body.status).toBe('succeeded');
    expect(body.amount).toBe(4900);
    expect(body.currency).toBe('usd');
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_abc123', amount: 4900 }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it('returns 200 for an owner-role user (not admin)', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_owner123',
      status: 'succeeded',
      amount: 2000,
      currency: 'usd',
    });

    const app = createApp(OWNER_USER);
    const res = await app.request(post('/refund', { chargeId: 'ch_abc123' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.refundId).toBe('re_owner123');
  });

  it('falls back to "pending" when Stripe returns null status', async () => {
    mockRefundsCreate.mockResolvedValue({
      id: 're_null_status',
      status: null,
      amount: 1000,
      currency: 'usd',
    });

    const app = createApp(ADMIN_USER);
    const res = await app.request(post('/refund', { chargeId: 'ch_null_status' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('pending');
  });
});
