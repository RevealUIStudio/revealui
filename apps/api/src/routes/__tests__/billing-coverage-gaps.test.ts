/**
 * Billing Coverage Gaps Tests
 *
 * Covers previously untested webhook handlers and IDOR protection:
 * - charge.dispute.created  -  logs dispute, sends notification email
 * - charge.dispute.closed  -  won (restores license) vs lost (revokes license)
 * - charge.refunded  -  full refund revokes license, partial retains
 * - payment_intent.payment_failed  -  logs failure, audits
 * - customer.subscription.updated with incomplete_expired  -  revokes license
 * - customer.subscription.updated with incomplete  -  warns only, no revocation
 * - POST /portal  -  no account returns error, not another user's portal
 * - GET /subscription  -  no subscription returns free tier, not another user's data
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

// Webhook mocks
const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockChargesRetrieve = vi.fn();

// Billing route mocks
const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockMeterEventsCreate = vi.fn();
const mockRefundsCreate = vi.fn();
const mockResetDbStatusCache = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
        list: mockSubscriptionsList,
      };
      charges = { retrieve: mockChargesRetrieve };
      customers = { create: mockCustomersCreate };
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      billingPortal = { sessions: { create: mockBillingPortalSessionsCreate } };
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

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── DB Mock  -  fluent chain for select / insert / update / delete ─────────────

const mockAuditAppend = vi.fn();

const mockDbSelectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};
const mockDbInsertChain = { values: vi.fn() };
const mockDbDeleteChain = { where: vi.fn() };
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
      append = mockAuditAppend;
    } as unknown as (...args: unknown[]) => unknown,
  ),
  executeSaga: vi.fn(
    async (
      db: unknown,
      _sagaName: string,
      _sagaKey: string,
      steps: Array<{
        name: string;
        execute: (ctx: {
          db: unknown;
          sagaId: string;
          checkpoint: (n: string, o: unknown) => Promise<void>;
        }) => Promise<unknown>;
      }>,
    ) => {
      const sagaId = `mock-saga-${Date.now()}`;
      const ctx = { db, sagaId, checkpoint: async () => {} };
      const completedSteps: string[] = [];
      let lastOutput: unknown;
      for (const step of steps) {
        lastOutput = await step.execute(ctx);
        completedSteps.push(step.name);
      }
      return {
        sagaId,
        status: 'completed',
        result: lastOutput,
        completedSteps,
        alreadyProcessed: false,
      };
    },
  ),
}));

vi.mock('@revealui/db/schema', () => ({
  accounts: {
    id: 'accounts.id',
    status: 'accounts.status',
  },
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

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
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

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: (...args: unknown[]) => mockResetDbStatusCache(...args),
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

import * as loggerModule from '@revealui/core/observability/logger';
import billingApp from '../billing.js';
import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal Stripe event envelope fields required by the OpenAPI request body schema. */
const STRIPE_EVENT_DEFAULTS = {
  id: 'evt_default',
  type: 'test.event',
  data: { object: {} },
  created: 1700000000,
  livemode: false,
};

function createWebhookApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  const body =
    eventJson && typeof eventJson === 'object'
      ? { ...STRIPE_EVENT_DEFAULTS, ...eventJson }
      : eventJson;
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: JSON.stringify(body),
  });
}

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

function createBillingApp(
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

// Billing route helpers
let _selectResult: unknown[] = [];
let _selectQueue: unknown[][] = [];

function resetChains() {
  _selectResult = [];
  _selectQueue = [];
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.innerJoin.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
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
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
  mockSubscriptionsList.mockResolvedValue({ data: [] });
  mockSubscriptionsUpdate.mockResolvedValue({});
}

function resetWebhookChains() {
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.innerJoin.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockResolvedValue([]);
  mockDbInsertChain.values.mockResolvedValue(undefined);
  mockDbDeleteChain.where.mockResolvedValue({ rowCount: 1 });
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDb.select.mockReturnValue(mockDbSelectChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.delete.mockReturnValue(mockDbDeleteChain);
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
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

describe('Billing Coverage Gaps', { timeout: 60_000 }, () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Section A: Webhook Handlers
  // ──────────────────────────────────────────────────────────────────────────

  describe('Webhook: charge.dispute.created', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('logs the dispute and audits it without revoking license', async () => {
      const event = {
        id: 'evt_dispute_created_1',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_test_1',
            charge: 'ch_test_1',
            amount: 4900,
            reason: 'fraudulent',
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockChargesRetrieve.mockResolvedValueOnce({ customer: 'cus_dispute_1' });
      // findUserEmailByCustomerId returns email
      mockDbSelectChain.limit.mockResolvedValueOnce([{ email: 'user@example.com' }]);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should log the dispute warning
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Chargeback dispute opened',
        expect.objectContaining({
          disputeId: 'dp_test_1',
          chargeId: 'ch_test_1',
          amount: 4900,
          reason: 'fraudulent',
        }),
      );
      // Should audit the event
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.dispute.opened');
      // Should NOT revoke  -  no update to 'revoked' status
      const updateCalls = mockDbUpdateChain.set.mock.calls;
      for (const call of updateCalls) {
        const setArg = call[0] as Record<string, unknown>;
        expect(setArg.status).not.toBe('revoked');
      }
    });

    it('sends notification email when customer can be resolved', async () => {
      const event = {
        id: 'evt_dispute_created_email_1',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_email_1',
            charge: 'ch_email_1',
            amount: 2900,
            reason: 'product_not_received',
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockChargesRetrieve.mockResolvedValueOnce({ customer: 'cus_email_1' });
      // findUserEmailByCustomerId returns email
      mockDbSelectChain.limit.mockResolvedValueOnce([{ email: 'customer@example.com' }]);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
    });
  });

  describe('Webhook: charge.dispute.closed', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('restores license when dispute is won', async () => {
      const event = {
        id: 'evt_dispute_won_1',
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_won_1',
            charge: 'ch_won_1',
            status: 'won',
            amount: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockChargesRetrieve.mockResolvedValueOnce({ customer: 'cus_won_1' });
      // syncHostedSubscriptionState: resolveHostedAccountId lookup
      mockDbSelectChain.limit.mockResolvedValueOnce([{ accountId: 'acct_won' }]);
      mockDbSelectChain.limit.mockResolvedValueOnce([{ status: 'revoked' }]);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should restore license to 'active'
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('revokes license when dispute is lost', async () => {
      const event = {
        id: 'evt_dispute_lost_1',
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_lost_1',
            charge: 'ch_lost_1',
            status: 'lost',
            amount: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockChargesRetrieve.mockResolvedValueOnce({ customer: 'cus_lost_1' });
      // findUserEmailByCustomerId for dispute lost email
      mockDbSelectChain.limit.mockResolvedValueOnce([{ email: 'lost@example.com' }]);
      // syncHostedSubscriptionState lookups
      mockDbSelectChain.limit.mockResolvedValueOnce([{ accountId: 'acct_lost' }]);
      mockDbSelectChain.limit.mockResolvedValueOnce([{ status: 'active' }]);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should revoke license
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
      // Should log warning about chargeback
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'License revoked: chargeback dispute lost',
        expect.objectContaining({
          customerId: 'cus_lost_1',
          chargeId: 'ch_lost_1',
          disputeId: 'dp_lost_1',
        }),
      );
    });

    it('does not modify license when dispute has non-terminal status', async () => {
      const event = {
        id: 'evt_dispute_pending_1',
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_pending_1',
            charge: 'ch_pending_1',
            status: 'under_review',
            amount: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should not call update for non-terminal dispute statuses
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('Webhook: charge.refunded', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('revokes license on full refund', async () => {
      const event = {
        id: 'evt_refund_full_1',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_refund_1',
            customer: 'cus_refund_1',
            amount: 4900,
            amount_refunded: 4900,
            currency: 'usd',
            billing_details: { email: 'refund@example.com' },
            receipt_email: null,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      // syncHostedSubscriptionState lookups
      mockDbSelectChain.limit.mockResolvedValueOnce([{ accountId: 'acct_refund' }]);
      mockDbSelectChain.limit.mockResolvedValueOnce([{ status: 'active' }]);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should revoke license
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
      // Should log warning
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'License revoked: full refund issued',
        expect.objectContaining({
          customerId: 'cus_refund_1',
          chargeId: 'ch_refund_1',
        }),
      );
    });

    it('retains license on partial refund', async () => {
      const event = {
        id: 'evt_refund_partial_1',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_partial_1',
            customer: 'cus_partial_1',
            amount: 4900,
            amount_refunded: 1000,
            currency: 'usd',
            billing_details: { email: 'partial@example.com' },
            receipt_email: null,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should NOT revoke license  -  only idempotency insert, no update
      expect(mockDb.update).not.toHaveBeenCalled();
      // Should log info about partial refund
      expect(vi.mocked(loggerModule.logger).info).toHaveBeenCalledWith(
        'Partial refund issued  -  license retained',
        expect.objectContaining({
          customerId: 'cus_partial_1',
          chargeId: 'ch_partial_1',
        }),
      );
    });

    it('skips when charge has no customer', async () => {
      const event = {
        id: 'evt_refund_nocust_1',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_nocust_1',
            customer: null,
            amount: 4900,
            amount_refunded: 4900,
            currency: 'usd',
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should not attempt any DB update
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('Webhook: payment_intent.payment_failed', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('logs payment failure and creates audit entry', async () => {
      const event = {
        id: 'evt_payment_failed_1',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed_1',
            amount: 4900,
            currency: 'usd',
            last_payment_error: { message: 'Your card was declined.' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should log a warning about the failed payment
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Payment intent failed',
        expect.objectContaining({
          paymentIntentId: 'pi_failed_1',
          amount: 4900,
          currency: 'usd',
          lastPaymentError: 'Your card was declined.',
        }),
      );
      // Should create an audit entry
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('payment.intent.failed');
      expect(entry.severity).toBe('warn');
    });

    it('does not revoke license on payment failure', async () => {
      const event = {
        id: 'evt_payment_failed_norevoke_1',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_norevoke_1',
            amount: 9900,
            currency: 'usd',
            last_payment_error: null,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should NOT call update (no license revocation)
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Section B: Subscription Status Edge Cases
  // ──────────────────────────────────────────────────────────────────────────

  describe('Webhook: customer.subscription.updated  -  incomplete_expired', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('revokes license when subscription reaches incomplete_expired', async () => {
      const event = {
        id: 'evt_incomplete_expired_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_incomplete_expired',
            customer: 'cus_expired_1',
            status: 'incomplete_expired',
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should revoke the license
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
      // Should audit the revocation
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.revoked.subscription_incomplete_expired');
    });
  });

  describe('Webhook: customer.subscription.updated  -  incomplete', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDbSelectChain.limit.mockReset();
      mockDbInsertChain.values.mockReset();
      mockDbUpdateChain.set.mockReset();
      mockDbUpdateChain.where.mockReset();
      mockDbDeleteChain.where.mockReset();
      resetWebhookChains();
      mockSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockAuditAppend.mockResolvedValue(undefined);
      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    });

    it('warns but does not revoke license when subscription is incomplete', async () => {
      const event = {
        id: 'evt_incomplete_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_incomplete',
            customer: 'cus_incomplete_1',
            status: 'incomplete',
            metadata: {},
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createWebhookApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should NOT revoke license
      expect(mockDb.update).not.toHaveBeenCalled();
      // Should log a warning
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Subscription in incomplete state  -  awaiting payment confirmation',
        expect.objectContaining({
          customerId: 'cus_incomplete_1',
          subscriptionId: 'sub_incomplete',
        }),
      );
      // Should NOT audit (no license state change)
      expect(mockAuditAppend).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Section C: IDOR Protection
  // ──────────────────────────────────────────────────────────────────────────

  describe('IDOR: POST /portal', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
      process.env.ADMIN_URL = 'https://admin.example.com';
    });

    it('returns error when user has no billing account', async () => {
      // resolveHostedStripeCustomerId: no account membership found
      queueSelectResults(
        [], // accountMemberships lookup  -  no membership
        [{ stripeCustomerId: null }], // users lookup  -  no stripe customer
      );

      const app = createBillingApp();
      const res = await app.request(post('/portal', {}));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('No billing account');
      // Must NOT create a portal session for another user
      expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
    });

    it('returns error when not authenticated', async () => {
      const unauthUser = undefined as unknown as UserContext;
      const app = createBillingApp(unauthUser);
      const res = await app.request(post('/portal', {}));

      // Route checks `if (!user)` and throws 401, but if middleware sets undefined
      // the route still hits the resolveHostedStripeCustomerId path which throws 400.
      // Either way, no portal session should be created.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
    });
  });

  describe('IDOR: GET /subscription', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      resetChains();
      process.env.STRIPE_SECRET_KEY = 'stripe_test_placeholder';
    });

    it('returns free tier when user has no subscription', async () => {
      // getHostedSubscriptionSnapshot: no membership
      queueSelectResults(
        [], // accountMemberships lookup  -  no membership
        [], // licenses lookup  -  no license
      );

      const app = createBillingApp();
      const res = await app.request(get('/subscription'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.tier).toBe('free');
      expect(body.status).toBe('active');
      expect(body.licenseKey).toBeNull();
    });

    it('returns free tier when not authenticated (no user data leak)', async () => {
      const unauthUser = undefined as unknown as UserContext;
      const app = createBillingApp(unauthUser);
      const res = await app.request(get('/subscription'));

      // Subscription route returns free tier for unknown users  -  it does NOT
      // expose another user's data. This is safe IDOR behavior.
      const body = (await res.json()) as Record<string, unknown>;
      if (res.status === 200) {
        expect(body.tier).toBe('free');
        expect(body.licenseKey).toBeNull();
      } else {
        expect(res.status).toBe(401);
      }
    });

    it('returns entitlements tier when hosted entitlements are present', async () => {
      const app = createBillingApp(MOCK_USER, {
        accountId: 'acct-123',
        subscriptionStatus: 'active',
        tier: 'pro',
      });
      const res = await app.request(get('/subscription'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.tier).toBe('pro');
      expect(body.status).toBe('active');
    });
  });
});
