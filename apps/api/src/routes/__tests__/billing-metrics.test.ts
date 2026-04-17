/**
 * Billing Metrics & RVUI Payment Tests
 *
 * Covers:
 * - GET /metrics  -  admin-only revenue metrics endpoint
 *   - Auth/access control (401, 403)
 *   - Date range validation (invalid, future, reversed, >365d)
 *   - Response shape (subscription counts, tier breakdown, MRR, events)
 *   - MRR fallback pricing when catalog is empty
 * - POST /rvui-payment  -  disabled endpoint (501)
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockMeterEventsCreate = vi.fn();
const mockRefundsCreate = vi.fn();

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

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn(),
  resetLicenseState: vi.fn(),
  getMaxAgentTasks: vi.fn(() => 10_000),
}));

vi.mock('@revealui/core/observability/logger', () => {
  const mockLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: mockLog, createLogger: () => mockLog };
});

// ─── DB Mock ─────────────────────────────────────────────────────────────────

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  groupBy: vi.fn(),
};

const mockDbInsertChain = { values: vi.fn() };
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  DrizzleAuditStore: vi.fn().mockImplementation(
    class {
      append = vi.fn();
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/db/schema', () => ({
  accounts: { id: 'accounts.id', status: 'accounts.status' },
  accountMemberships: {
    id: 'accountMemberships.id',
    accountId: 'accountMemberships.accountId',
    userId: 'accountMemberships.userId',
    status: 'accountMemberships.status',
  },
  accountSubscriptions: {
    id: 'accountSubscriptions.id',
    accountId: 'accountSubscriptions.accountId',
    stripeCustomerId: 'accountSubscriptions.stripeCustomerId',
    status: 'accountSubscriptions.status',
    updatedAt: 'accountSubscriptions.updatedAt',
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
    metadata: 'billingCatalog.metadata',
    billingModel: 'billingCatalog.billingModel',
    active: 'billingCatalog.active',
  },
  licenses: {
    id: 'licenses.id',
    customerId: 'licenses.customerId',
    subscriptionId: 'licenses.subscriptionId',
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
    tier: 'licenses.tier',
    userId: 'licenses.userId',
    expiresAt: 'licenses.expiresAt',
    licenseKey: 'licenses.licenseKey',
    createdAt: 'licenses.createdAt',
    perpetual: 'licenses.perpetual',
    supportExpiresAt: 'licenses.supportExpiresAt',
  },
  processedWebhookEvents: {
    id: 'processedWebhookEvents.id',
    eventType: 'processedWebhookEvents.eventType',
    processedAt: 'processedWebhookEvents.processedAt',
  },
  users: {
    id: 'users.id',
    stripeCustomerId: 'users.stripeCustomerId',
    email: 'users.email',
    name: 'users.name',
    updatedAt: 'users.updatedAt',
  },
  agentTaskUsage: {
    userId: 'agentTaskUsage.userId',
    overage: 'agentTaskUsage.overage',
    count: 'agentTaskUsage.count',
    cycleStart: 'agentTaskUsage.cycleStart',
  },
  agentCreditBalance: { userId: 'agentCreditBalance.userId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  desc: vi.fn((_col) => `desc(${String(_col)})`),
  gt: vi.fn((_col, _val) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col, _val) => `gte(${String(_col)},${String(_val)})`),
  lte: vi.fn((_col, _val) => `lte(${String(_col)},${String(_val)})`),
  lt: vi.fn((_col, _val) => `lt(${String(_col)},${String(_val)})`),
  isNull: vi.fn((_col) => `isNull(${String(_col)})`),
  count: vi.fn(() => 'count()'),
  countDistinct: vi.fn((_col) => `countDistinct(${String(_col)})`),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => `sql(${args.join(',')})`),
    { join: vi.fn((...args: unknown[]) => `sql.join(${args.join(',')})`) },
  ),
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendCancellationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendGracePeriodStartedEmail: vi.fn().mockResolvedValue(undefined),
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/webhook-emails.js', () => ({
  sendDowngradeConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendUpgradeConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
  requireLicense: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
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

// ─── Import under test (after mocks) ─────────────────────────────────────────

import billingApp from '../billing.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const ADMIN_USER: UserContext = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
};

const OWNER_USER: UserContext = {
  id: 'user-owner',
  email: 'owner@example.com',
  name: 'Owner User',
  role: 'owner',
};

const REGULAR_USER: UserContext = {
  id: 'user-regular',
  email: 'user@example.com',
  name: 'Regular User',
  role: 'user',
};

function createBillingApp(user?: UserContext) {
  const app = new Hono<{ Variables: { user: UserContext | undefined } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
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

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── DB chain helpers ────────────────────────────────────────────────────────

let _selectResult: unknown[] = [];
let _selectQueue: unknown[][] = [];

function resetChains() {
  _selectResult = [];
  _selectQueue = [];

  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.innerJoin.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.groupBy.mockReturnValue(mockDbSelectChain);

  // Make the chain thenable for `await db.select().from().where()`
  // NOTE: select() sets _selectResult from the queue; then() just reads it.
  Object.defineProperty(mockDbSelectChain, 'then', {
    value(
      onFulfilled?: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(_selectResult).then(onFulfilled, onRejected);
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(mockDbSelectChain, 'catch', {
    value(onRejected: (reason: unknown) => unknown) {
      return Promise.resolve(_selectResult).catch(onRejected);
    },
    writable: true,
    configurable: true,
  });

  mockDbSelectChain.limit.mockImplementation(() => {
    const result = _selectQueue.length > 0 ? (_selectQueue.shift() ?? []) : _selectResult;
    return Promise.resolve(result);
  });

  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });

  mockDb.select.mockImplementation(() => {
    if (_selectQueue.length > 0) {
      _selectResult = _selectQueue.shift() ?? [];
    }
    return mockDbSelectChain;
  });
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );

  mockSubscriptionsList.mockResolvedValue({ data: [] });
  mockSubscriptionsUpdate.mockResolvedValue({});
}

function queueSelectResults(...results: unknown[][]) {
  _selectQueue = [...results];
}

/**
 * Queue the 4 DB results that GET /metrics expects:
 *  1. [{ activeCount, uniqueCustomers }]  -  subscription stats
 *  2. [{ tier, tierCount }]  -  tier breakdown rows
 *  3. [{ tier, metadata }]  -  catalog prices
 *  4. [{ eventType, processedAt }]  -  recent events (via .limit())
 */
function queueMetricsResults(opts: {
  subStats?: { activeCount: number; uniqueCustomers: number };
  tierRows?: Array<{ tier: string; tierCount: number }>;
  catalogRows?: Array<{ tier: string; metadata: Record<string, unknown> | null }>;
  recentEvents?: Array<{ eventType: string; processedAt: Date }>;
}) {
  const subStats = opts.subStats ?? { activeCount: 0, uniqueCustomers: 0 };
  const tierRows = opts.tierRows ?? [];
  const catalogRows = opts.catalogRows ?? [];
  const recentEvents = opts.recentEvents ?? [];

  // Queries 1-3 resolve via thenable chain, query 4 via .limit()
  queueSelectResults([subStats], tierRows, catalogRows);
  mockDbSelectChain.limit.mockResolvedValue(recentEvents);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Billing Metrics & RVUI Payment', { timeout: 60_000 }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Section A: GET /metrics  -  Auth & Access Control
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /metrics  -  Auth & Access Control', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
    });

    it('returns 401 when not authenticated', async () => {
      const app = createBillingApp(); // no user
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/authentication/i);
    });

    it('returns 403 for regular user', async () => {
      const app = createBillingApp(REGULAR_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/admin/i);
    });

    it('returns 200 for admin user', async () => {
      queueMetricsResults({});
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
    });

    it('returns 200 for owner user', async () => {
      queueMetricsResults({});
      const app = createBillingApp(OWNER_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Section B: GET /metrics  -  Date Range Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /metrics  -  Date Range Validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
    });

    it('rejects invalid "from" date format', async () => {
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics?from=not-a-date'));

      // OpenAPI schema validation catches non-datetime strings
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects invalid "to" date format', async () => {
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics?to=garbage'));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects "from" >= "to"', async () => {
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(
        get('/metrics?from=2024-06-15T00:00:00.000Z&to=2024-06-15T00:00:00.000Z'),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/before/i);
    });

    it('rejects future dates', async () => {
      const futureDate = new Date(Date.now() + 86_400_000 * 30).toISOString();
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get(`/metrics?to=${futureDate}`));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/future/i);
    });

    it('rejects date range exceeding 365 days', async () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000).toISOString();
      const oneYearAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get(`/metrics?from=${twoYearsAgo}&to=${oneYearAgo}`));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/365/);
    });

    it('accepts valid custom date range', async () => {
      queueMetricsResults({});
      const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const to = new Date(Date.now() - 86_400_000).toISOString();
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get(`/metrics?from=${from}&to=${to}`));

      expect(res.status).toBe(200);
    });

    it('uses default 30-day range when no params given', async () => {
      queueMetricsResults({});
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      // Route runs without error, proving defaults work
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Section C: GET /metrics  -  Response Data
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /metrics  -  Response Data', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
    });

    it('returns correct subscription counts', async () => {
      queueMetricsResults({
        subStats: { activeCount: 42, uniqueCustomers: 38 },
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.activeSubscriptions).toBe(42);
      expect(body.totalCustomers).toBe(38);
    });

    it('returns correct tier breakdown', async () => {
      queueMetricsResults({
        tierRows: [
          { tier: 'pro', tierCount: 15 },
          { tier: 'max', tierCount: 8 },
          { tier: 'enterprise', tierCount: 2 },
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tierBreakdown).toEqual({ pro: 15, max: 8, enterprise: 2 });
    });

    it('calculates MRR from catalog prices', async () => {
      queueMetricsResults({
        tierRows: [
          { tier: 'pro', tierCount: 10 },
          { tier: 'max', tierCount: 5 },
        ],
        catalogRows: [
          { tier: 'pro', metadata: { unitAmountCents: 4900 } },
          { tier: 'max', metadata: { unitAmountCents: 14900 } },
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      // MRR = (10 * 4900) + (5 * 14900) = 49000 + 74500 = 123500
      expect(body.mrr).toBe(123_500);
    });

    it('uses fallback tier prices when catalog is empty', async () => {
      // Fallback: pro=4900, max=14900, enterprise=29900
      queueMetricsResults({
        tierRows: [
          { tier: 'pro', tierCount: 3 },
          { tier: 'max', tierCount: 1 },
          { tier: 'enterprise', tierCount: 1 },
        ],
        catalogRows: [], // no catalog entries
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      // MRR = (3 * 4900) + (1 * 14900) + (1 * 29900) = 14700 + 14900 + 29900 = 59500
      expect(body.mrr).toBe(59_500);
    });

    it('returns recent events with type mapping', async () => {
      const now = new Date();
      queueMetricsResults({
        recentEvents: [
          { eventType: 'checkout.session.completed', processedAt: now },
          { eventType: 'customer.subscription.deleted', processedAt: now },
          { eventType: 'invoice.payment_succeeded', processedAt: now },
          { eventType: 'invoice.payment_failed', processedAt: now },
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.recentEvents).toHaveLength(4);
      expect(body.recentEvents[0].type).toBe('subscription_created');
      expect(body.recentEvents[1].type).toBe('subscription_cancelled');
      expect(body.recentEvents[2].type).toBe('payment_succeeded');
      expect(body.recentEvents[3].type).toBe('payment_failed');
      // All events have tier: 'unknown' (route doesn't resolve tier from events)
      for (const event of body.recentEvents) {
        expect(event.tier).toBe('unknown');
        expect(event.createdAt).toBe(now.toISOString());
      }
    });

    it('returns zero data for fresh deployment', async () => {
      queueMetricsResults({});

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.activeSubscriptions).toBe(0);
      expect(body.totalCustomers).toBe(0);
      expect(body.mrr).toBe(0);
      expect(body.tierBreakdown).toEqual({ pro: 0, max: 0, enterprise: 0 });
      expect(body.recentEvents).toEqual([]);
    });

    it('handles mixed tier counts with partial catalog coverage', async () => {
      queueMetricsResults({
        subStats: { activeCount: 7, uniqueCustomers: 6 },
        tierRows: [
          { tier: 'pro', tierCount: 5 },
          { tier: 'enterprise', tierCount: 2 },
          // no 'max' entitlements
        ],
        catalogRows: [
          { tier: 'pro', metadata: { unitAmountCents: 3900 } }, // custom price
          // enterprise not in catalog  -  falls back to 29900
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tierBreakdown).toEqual({ pro: 5, max: 0, enterprise: 2 });
      // MRR = (5 * 3900) + (0 * anything) + (2 * 29900) = 19500 + 0 + 59800 = 79300
      expect(body.mrr).toBe(79_300);
    });

    it('ignores unknown tiers in breakdown', async () => {
      queueMetricsResults({
        tierRows: [
          { tier: 'pro', tierCount: 1 },
          { tier: 'unknown_tier', tierCount: 99 }, // not pro/max/enterprise
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tierBreakdown).toEqual({ pro: 1, max: 0, enterprise: 0 });
      // Only pro contributes to MRR
      expect(body.mrr).toBe(4900);
    });

    it('skips catalog entries with invalid metadata', async () => {
      queueMetricsResults({
        tierRows: [{ tier: 'pro', tierCount: 2 }],
        catalogRows: [
          { tier: 'pro', metadata: null }, // null metadata
          { tier: 'max', metadata: { unitAmountCents: 'not-a-number' } }, // NaN
        ],
      });

      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(get('/metrics'));

      expect(res.status).toBe(200);
      const body = await res.json();
      // Falls back to FALLBACK_TIER_PRICE_CENTS for pro (4900)
      expect(body.mrr).toBe(2 * 4900);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Section D: POST /rvui-payment  -  Disabled Endpoint
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /rvui-payment', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
    });

    it('returns 501 Not Implemented', async () => {
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(
        post('/rvui-payment', {
          txSignature: 'abc123',
          tier: 'Pro',
          walletAddress: 'wallet123',
          network: 'devnet',
        }),
      );

      expect(res.status).toBe(501);
    });

    it('response indicates feature is unavailable', async () => {
      const app = createBillingApp(ADMIN_USER);
      const res = await app.request(
        post('/rvui-payment', {
          txSignature: 'abc123',
          tier: 'Pro',
          walletAddress: 'wallet123',
          network: 'devnet',
        }),
      );

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.tier).toBe('none');
      expect(body.message).toMatch(/not yet available/i);
    });

    it('returns 501 regardless of auth state', async () => {
      const app = createBillingApp(REGULAR_USER);
      const res = await app.request(
        post('/rvui-payment', {
          txSignature: 'sig',
          tier: 'Max',
          walletAddress: 'wallet',
          network: 'devnet',
        }),
      );

      expect(res.status).toBe(501);
    });
  });
});
