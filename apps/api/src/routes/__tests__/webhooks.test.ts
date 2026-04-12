/**
 * Stripe Webhook Handler Tests
 *
 * Covers: signature verification, idempotency, and license lifecycle events
 * (created, revoked, expired, reactivated).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    // Must use a class  -  webhooks.ts calls `new Stripe(key)`
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
        list: mockSubscriptionsList,
      };
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
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── DB Mock  -  fluent chain for select / insert / update ─────────────────────

const mockAuditAppend = vi.fn();

const mockDbSelectChain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
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
  // Must use a class  -  auditLicenseEvent calls `new DrizzleAuditStore(db)`
  DrizzleAuditStore: vi.fn().mockImplementation(
    class {
      append = mockAuditAppend;
    } as unknown as (...args: unknown[]) => unknown,
  ),
  // executeSaga: run steps sequentially against mockDb, return completed result.
  // Mirrors the real saga executor closely enough for webhook handler tests.
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
      const ctx = {
        db,
        sagaId,
        checkpoint: async () => {},
      };
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
  },
  licenses: {
    id: 'licenses.id',
    customerId: 'licenses.customerId',
    subscriptionId: 'licenses.subscriptionId',
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
    tier: 'licenses.tier',
    deletedAt: 'licenses.deletedAt',
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
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  desc: vi.fn((_col) => `desc(${String(_col)})`),
  isNull: vi.fn((_col) => `isNull(${String(_col)})`),
}));

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import * as licenseModule from '@revealui/core/license';
import * as loggerModule from '@revealui/core/observability/logger';
import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

/** Minimal Stripe event envelope fields required by the OpenAPI request body schema. */
const STRIPE_EVENT_DEFAULTS = {
  id: 'evt_default',
  type: 'test.event',
  data: { object: {} },
  created: 1700000000,
  livemode: false,
};

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  // Merge defaults so test payloads pass the Stripe event envelope schema validation.
  // The handler ignores the parsed body  -  it uses stripe.webhooks.constructEventAsync() instead.
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

function makeSubscriptionDeletedEvent(id: string) {
  return {
    id,
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_test', customer: 'cus_test' } },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mockResolvedValueOnce queues on the DB chain mocks.
    // vi.clearAllMocks() clears call history but NOT unconsumed once-values.
    // Tests that throw before consuming their DB mocks (e.g. resolveTier rejection)
    // would otherwise leak values into subsequent tests.
    mockDbSelectChain.limit.mockReset();
    mockDbInsertChain.values.mockReset();
    mockDbUpdateChain.set.mockReset();
    mockDbUpdateChain.where.mockReset();
    mockDbDeleteChain.where.mockReset();

    // Defaults for all tests (re-applied after clearAllMocks + targeted resets)
    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-test-123');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockAuditAppend.mockResolvedValue(undefined);

    // Re-wire fluent chain mocks
    mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.limit.mockResolvedValue([]); // default: not found
    mockDbInsertChain.values.mockResolvedValue(undefined);
    mockDbDeleteChain.where.mockResolvedValue({ rowCount: 1 });
    mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
    mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
    mockDb.select.mockReturnValue(mockDbSelectChain);
    mockDb.insert.mockReturnValue(mockDbInsertChain);
    mockDb.delete.mockReturnValue(mockDbDeleteChain);
    mockDb.update.mockReturnValue(mockDbUpdateChain);
    // transaction: execute callback immediately with the same mock db as `tx`
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
      cb(mockDb),
    );

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
  });

  describe('Request validation', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const app = createApp();
      const res = await app.request(
        new Request('http://localhost/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(STRIPE_EVENT_DEFAULTS),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Missing Stripe-Signature');
    });

    it('returns 400 when signature verification fails', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      const app = createApp();
      const res = await app.request(postStripe({}, 'bad-sig'));
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error as string).toContain('Invalid webhook signature');
    });

    it('returns 200 for irrelevant event types', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_irrelevant',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const app = createApp();
      const res = await app.request(postStripe({}));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
      expect(body.duplicate).toBeUndefined();
    });
  });

  describe('Idempotency', () => {
    it('returns duplicate:true when the same event ID is sent twice', async () => {
      const event = makeSubscriptionDeletedEvent('evt_idempotency_unique_99');
      mockConstructEvent.mockReturnValue(event);

      const app = createApp();

      // First request  -  processes normally (idempotency insert succeeds)
      const res1 = await app.request(postStripe(event));
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as Record<string, unknown>;
      expect(body1.duplicate).toBeUndefined();

      // Second request with same event ID  -  idempotency insert throws unique constraint
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "processed_webhook_events_pkey"'),
      );
      const res2 = await app.request(postStripe(event));
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as Record<string, unknown>;
      expect(body2.duplicate).toBe(true);

      // DB update called only once (first request)
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('customer.subscription.deleted', () => {
    it('revokes all licenses for the customer and returns 200', async () => {
      const event = makeSubscriptionDeletedEvent('evt_deleted_revoke_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);

      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });

    it('always writes audit log for license lifecycle events (compliance)', async () => {
      const event = makeSubscriptionDeletedEvent('evt_deleted_audit_2');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.revoked');
      expect(entry.severity).toBe('warn');
      expect(entry.agentId).toBe('system:stripe-webhook');
    });
  });

  describe('customer.subscription.updated', () => {
    it('marks license as expired when subscription is past_due', async () => {
      const event = {
        id: 'evt_updated_pastdue_2',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'past_due' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);

      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('expired');
    });

    it('marks license as expired when subscription is unpaid', async () => {
      const event = {
        id: 'evt_updated_unpaid_2',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'unpaid' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);

      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('expired');
    });

    it('reactivates license when subscription becomes active', async () => {
      const event = {
        id: 'evt_updated_active_2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);

      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('writes license.grace_period audit entry when subscription goes past_due', async () => {
      const event = {
        id: 'evt_updated_pastdue_audit_2',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'past_due' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.grace_period');
    });
  });

  describe('checkout.session.completed', () => {
    it('skips non-subscription checkout sessions', async () => {
      const event = {
        id: 'evt_checkout_payment_2',
        type: 'checkout.session.completed',
        data: {
          object: { mode: 'payment', subscription: null, customer: 'cus_test', metadata: {} },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);
      // Only the idempotency insert fires  -  no license insert for non-subscription checkout
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('logs error and returns 500 when no user can be resolved', async () => {
      // No userId in metadata and no user found in DB
      mockDbSelectChain.limit.mockResolvedValueOnce([]);

      const event = {
        id: 'evt_checkout_nouser_2',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'pro' }, // no revealui_user_id
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Handler throws when user can't be resolved so Stripe retries
      expect(res.status).toBe(500);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot resolve user'),
        undefined,
        expect.objectContaining({ customerId: 'cus_test' }),
      );
    });

    it('creates license with trialing status when subscription is in trial', async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // +7 days
      mockSubscriptionsRetrieve.mockResolvedValueOnce({ status: 'trialing', trial_end: trialEnd });
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_trial' }]);

      const event = {
        id: 'evt_checkout_trial_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_trialing',
            customer: 'cus_trial',
            metadata: { tier: 'pro', revealui_user_id: 'user_trial' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // calls[0] = idempotency insert; calls[1] = license insert
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const insertValues = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(insertValues.status).toBe('trialing');
      expect(insertValues.expiresAt).toBeInstanceOf(Date);
    });

    it('returns 500 when subscription retrieve fails so Stripe retries', async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Stripe timeout'));
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_abc' }]);

      const event = {
        id: 'evt_checkout_retrieve_fail_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'pro', revealui_user_id: 'user_abc' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Should return 500 so Stripe retries  -  we cannot determine trialing vs active
      // without the subscription object
      expect(res.status).toBe(500);
    });

    it('creates license when userId is provided in metadata', async () => {
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_abc' }]);

      const event = {
        id: 'evt_checkout_success_2',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'pro', revealui_user_id: 'user_abc' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(licenseModule.generateLicenseKey).toHaveBeenCalledOnce();
      // calls[0] = idempotency insert; calls[1] = license insert
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const insertValues = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(insertValues.status).toBe('active');
      expect(insertValues.tier).toBe('pro');
      expect(insertValues.userId).toBe('user_abc');
    });

    it('rejects webhook when tier metadata is missing', async () => {
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_missing_tier' }]);

      const event = {
        id: 'evt_checkout_missing_tier_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { revealui_user_id: 'user_missing_tier' },
            // no tier in metadata
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Missing tier now rejects so Stripe retries  -  no license created
      expect(res.status).toBe(500);
      // CRITICAL logger.error was called
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({ tier: null }),
      );
      // Alert email was sent (fire-and-forget via dynamic import  -  use waitFor)
      await vi.waitFor(
        () => {
          expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              to: 'founder@revealui.com',
              subject: expect.stringContaining('CRITICAL'),
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it('rejects webhook when tier metadata is unrecognized', async () => {
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_bad_tier' }]);

      const event = {
        id: 'evt_checkout_bad_tier_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'platinum', revealui_user_id: 'user_bad_tier' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Unrecognized tier now rejects so Stripe retries  -  no license created
      expect(res.status).toBe(500);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({ tier: 'platinum' }),
      );
      await vi.waitFor(
        () => {
          expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              to: 'founder@revealui.com',
              subject: expect.stringContaining('CRITICAL'),
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it('rejects webhook and logs alert failure when tier metadata is missing and alert email fails', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));
      // Transaction's inner user-existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_email_fail' }]);

      const event = {
        id: 'evt_checkout_email_fail_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { revealui_user_id: 'user_email_fail' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Missing tier metadata now rejects the webhook so Stripe retries
      expect(res.status).toBe(500);
      // Allow the fire-and-forget .catch() to settle
      await vi.waitFor(
        () => {
          expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
            'Failed to send tier fallback alert',
            undefined,
            expect.objectContaining({ detail: 'SMTP down' }),
          );
        },
        { timeout: 1000 },
      );
    });

    it('clears the idempotency marker when processing fails after the initial insert', async () => {
      const event = {
        id: 'evt_checkout_retry_recover_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: {},
          },
        },
      };

      mockConstructEvent.mockReturnValueOnce(event);
      mockDbSelectChain.limit.mockResolvedValueOnce([]);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
      expect(mockDb.delete).toHaveBeenCalledOnce();
      expect(mockDbDeleteChain.where).toHaveBeenCalledOnce();
    });
  });

  describe('invoice.payment_succeeded', () => {
    function makePaymentSucceededEvent(id: string, customerId = 'cus_recovery') {
      return {
        id,
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: `inv_${id}`,
            customer: customerId,
            customer_email: null,
          },
        },
      };
    }

    it('re-activates expired license when active subscription is found', async () => {
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'pro' } }],
      });
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'lic_expired', status: 'expired' }]);

      const event = makePaymentSucceededEvent('evt_payment_succeeded_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('re-activates revoked license when active subscription is found', async () => {
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'pro' } }],
      });
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'lic_revoked', status: 'revoked' }]);

      const event = makePaymentSucceededEvent('evt_payment_succeeded_revoked_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('skips re-activation when license is already active', async () => {
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'pro' } }],
      });
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'lic_active', status: 'active' }]);

      const event = makePaymentSucceededEvent('evt_payment_succeeded_already_active_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('skips when no active subscription is found after payment', async () => {
      mockSubscriptionsList.mockResolvedValueOnce({ data: [] });

      const event = makePaymentSucceededEvent('evt_payment_succeeded_no_sub_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('re-activates hosted entitlements even when no legacy license row exists', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        mockDbSelectChain.limit.mockResolvedValue(
          selectCallCount === 1
            ? []
            : selectCallCount === 2
              ? [{ accountId: 'acct_hosted' }]
              : selectCallCount === 3
                ? [{ status: 'expired' }]
                : selectCallCount === 4
                  ? [{ accountId: 'acct_hosted' }]
                  : selectCallCount === 5
                    ? [{ id: 'acct_sub_1', planId: 'enterprise' }]
                    : [{ accountId: 'acct_hosted', tier: 'enterprise' }],
        );
        return mockDbSelectChain;
      });
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'enterprise' } }],
      });

      const event = makePaymentSucceededEvent('evt_payment_succeeded_hosted_only_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(accountSubscriptionUpdate.status).toBe('active');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('active');
    });

    it('re-activates hosted entitlements when the legacy license is already active', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        mockDbSelectChain.limit.mockResolvedValue(
          selectCallCount === 1
            ? [{ id: 'lic_active', status: 'active' }]
            : selectCallCount === 2
              ? [{ accountId: 'acct_hosted' }]
              : selectCallCount === 3
                ? [{ status: 'expired' }]
                : selectCallCount === 4
                  ? [{ accountId: 'acct_hosted' }]
                  : selectCallCount === 5
                    ? [{ id: 'acct_sub_1', planId: 'enterprise' }]
                    : [{ accountId: 'acct_hosted', tier: 'enterprise' }],
        );
        return mockDbSelectChain;
      });
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'enterprise' } }],
      });

      const event = makePaymentSucceededEvent('evt_payment_succeeded_hosted_expired_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(accountSubscriptionUpdate.status).toBe('active');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('active');
    });

    it('heals missing hosted entitlements when payment succeeds', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        mockDbSelectChain.limit.mockResolvedValue(
          selectCallCount === 1
            ? []
            : selectCallCount === 2
              ? [{ accountId: 'acct_hosted' }]
              : selectCallCount === 3
                ? []
                : selectCallCount === 4
                  ? [{ accountId: 'acct_hosted' }]
                  : selectCallCount === 5
                    ? [{ id: 'acct_sub_1', planId: 'enterprise' }]
                    : [],
        );
        return mockDbSelectChain;
      });
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'enterprise' } }],
      });

      const event = makePaymentSucceededEvent('evt_payment_succeeded_heal_hosted_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      const insertedEntitlement = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<
        string,
        unknown
      >;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(accountSubscriptionUpdate.status).toBe('active');
      expect(insertedEntitlement.accountId).toBe('acct_hosted');
      expect(insertedEntitlement.tier).toBe('enterprise');
      expect(insertedEntitlement.status).toBe('active');
    });

    it('writes license.reactivated.payment_recovery audit entry', async () => {
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_recovery', metadata: { tier: 'pro' } }],
      });
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'lic_expired', status: 'expired' }]);

      const event = makePaymentSucceededEvent('evt_payment_succeeded_audit_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.reactivated.payment_recovery');
      expect(entry.severity).toBe('info');
    });
  });

  // ─── invoice.payment_failed ─────────────────────────────────────────────────

  describe('invoice.payment_failed handler', () => {
    function makePaymentFailedEvent(id: string, attemptCount: number, customerId = 'cus_fail') {
      return {
        id,
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_fail_test',
            customer: customerId,
            customer_email: 'fail@example.com',
            attempt_count: attemptCount,
          },
        },
      };
    }

    it('returns 200 and syncs entitlements to past_due after payment failure', async () => {
      const event = makePaymentFailedEvent('evt_pf_past_due_1', 1);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);

      // Audit event should record grace period for initial failures
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.grace_period.payment_failed');
    });

    it('suspends subscription and expires license after 3 consecutive failures', async () => {
      const event = makePaymentFailedEvent('evt_pf_suspended_1', 3);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);

      // Direct license expiry still happens for suspension (before syncHostedSubscriptionState)
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDbUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' }),
      );

      // resetLicenseState should be called for suspension
      expect(vi.mocked(licenseModule.resetLicenseState)).toHaveBeenCalled();
    });

    it('suspends subscription and expires license after more than 3 failures', async () => {
      const event = makePaymentFailedEvent('evt_pf_suspended_5', 5);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);

      // License should be expired directly
      expect(mockDbUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' }),
      );
    });

    it('logs error when suspending after 3+ failures', async () => {
      const event = makePaymentFailedEvent('evt_pf_log_error_1', 3);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const { logger: mockLogger } = loggerModule;
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Payment failed 3+ times  -  suspending subscription',
        undefined,
        expect.objectContaining({ customerId: 'cus_fail', attemptCount: 3 }),
      );
    });

    it('does not log error or expire license on first attempt (attempt_count=1)', async () => {
      const event = makePaymentFailedEvent('evt_pf_first_attempt', 1);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Should NOT log error for first attempt
      const { logger: mockLogger } = loggerModule;
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
