/**
 * Webhook Safety Tests — Money-critical paths
 *
 * Focused on the safety-critical paths that handle money:
 * 1. resolveTier() — known tiers return correctly, unknown/missing rejects webhook (500) with CRITICAL log
 * 2. Perpetual license failure — when userRow is null inside the transaction, handler throws (not returns silently)
 * 3. Idempotency — same event ID processed twice, second returns { duplicate: true }
 * 4. Missing webhook secret — returns 500
 * 5. Invalid signature — returns 400
 * 6. Webhook email functions — sendLicenseActivatedEmail, sendPaymentFailedEmail, etc. call sendEmail with sanitized headers
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockChargesRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
        list: mockSubscriptionsList,
      };
      customers = { update: mockCustomersUpdate };
      charges = { retrieve: mockChargesRetrieve };
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

// ─── DB Mock — fluent chain for select / insert / update / delete ────────────

const mockAuditAppend = vi.fn();

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};
const mockDbInsertChain = { values: vi.fn() };
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };
const mockDbDeleteChain = { where: vi.fn() };

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
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
    planId: 'accountSubscriptions.planId',
  },
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    tier: 'accountEntitlements.tier',
  },
  licenses: {
    id: 'licenses.id',
    customerId: 'licenses.customerId',
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
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
}));

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sanitizeEmailHeader: (value: string) => value.replace(/[\r\n]/g, ''),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import * as licenseModule from '@revealui/core/license';
import * as loggerModule from '@revealui/core/observability/logger';
import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig'): Request {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': sig,
    },
    body: JSON.stringify(eventJson),
  });
}

function resetDbChains(): void {
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockResolvedValue([]);
  mockDbInsertChain.values.mockResolvedValue(undefined);
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDbDeleteChain.where.mockResolvedValue({ rowCount: 1 });
  mockDb.select.mockReturnValue(mockDbSelectChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.delete.mockReturnValue(mockDbDeleteChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Webhook Safety — money-critical paths', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-safety-test');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockCustomersUpdate.mockResolvedValue({});
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_test', customer: 'cus_test' });
    mockAuditAppend.mockResolvedValue(undefined);

    resetDbChains();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    savedEnv.REVEALUI_LICENSE_PRIVATE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    savedEnv.REVEALUI_ALERT_EMAIL = process.env.REVEALUI_ALERT_EMAIL;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_safety';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    delete process.env.REVEALUI_ALERT_EMAIL;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. resolveTier() — tier resolution safety
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resolveTier() — tier resolution safety', () => {
    // Exercise resolveTier through the subscription.updated handler (status='active')
    // which calls resolveTier(subscription.metadata) and writes the resolved tier to the DB.

    it('resolves "pro" tier correctly without logging an error', async () => {
      const event = {
        id: 'evt_safety_tier_pro',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: { id: 'sub_t', customer: 'cus_t', status: 'active', metadata: { tier: 'pro' } },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('pro');
      // No CRITICAL error should be logged for known tiers
      expect(vi.mocked(loggerModule.logger).error).not.toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('resolves "max" tier correctly without logging an error', async () => {
      const event = {
        id: 'evt_safety_tier_max',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: { id: 'sub_t', customer: 'cus_t', status: 'active', metadata: { tier: 'max' } },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('max');
      expect(vi.mocked(loggerModule.logger).error).not.toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('resolves "enterprise" tier correctly without logging an error', async () => {
      const event = {
        id: 'evt_safety_tier_ent',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_t',
            customer: 'cus_t',
            status: 'active',
            metadata: { tier: 'enterprise' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('enterprise');
      expect(vi.mocked(loggerModule.logger).error).not.toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('rejects webhook with 500 and logs CRITICAL when tier is unknown', async () => {
      const event = {
        id: 'evt_safety_tier_unknown',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_t',
            customer: 'cus_t',
            status: 'active',
            metadata: { tier: 'diamond' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Webhook should fail so Stripe retries — do NOT default to 'pro'
      expect(res.status).toBe(500);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({ tier: 'diamond' }),
      );
    });

    it('rejects webhook with 500 and logs CRITICAL when tier metadata is missing entirely', async () => {
      const event = {
        id: 'evt_safety_tier_missing',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_t',
            customer: 'cus_t',
            status: 'active',
            metadata: {},
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Webhook should fail so Stripe retries — do NOT default to 'pro'
      expect(res.status).toBe(500);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({ tier: null }),
      );
    });

    it('sends a tier fallback alert email to founder when tier is missing', async () => {
      const event = {
        id: 'evt_safety_tier_alert_email',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_t',
            customer: 'cus_t',
            status: 'active',
            metadata: {},
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // The tier fallback alert is fire-and-forget, wait for it to settle
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

    it('uses REVEALUI_ALERT_EMAIL env var for fallback alert when set', async () => {
      process.env.REVEALUI_ALERT_EMAIL = 'ops@revealui.com';

      const event = {
        id: 'evt_safety_tier_alert_custom',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_t',
            customer: 'cus_t',
            status: 'active',
            metadata: { tier: 'nonexistent' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              to: 'ops@revealui.com',
            }),
          );
        },
        { timeout: 1000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Perpetual license failure — userRow null throws (not returns silently)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Perpetual license — userRow null throws', () => {
    function makePerpetualEvent(id: string, overrides: Record<string, unknown> = {}) {
      return {
        id,
        type: 'checkout.session.completed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            mode: 'payment',
            subscription: null,
            customer: 'cus_perp_safety',
            customer_email: 'perp@test.com',
            metadata: {
              tier: 'pro',
              revealui_user_id: 'user_perp_safety',
            },
            ...overrides,
          },
        },
      };
    }

    it('throws an error (returns 500) when userRow is null inside the transaction', async () => {
      // The outer user check resolves (revealui_user_id in metadata),
      // but the inner transaction's user query returns empty (userRow is null).
      // This simulates a race condition where the user was deleted between
      // the outer check and the transaction.
      //
      // Previously (the bug), this returned silently with HTTP 200, causing
      // Stripe to stop retrying and the customer to never receive their license.
      // The fix: throw an error so Stripe retries.

      // First DB call: idempotency insert (succeeds)
      // Second DB call: inner transaction user lookup (returns empty)
      mockDbSelectChain.limit.mockResolvedValue([]);

      const event = makePerpetualEvent('evt_perp_null_userrow');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // The handler must return 500 so Stripe retries
      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Webhook processing failed');

      // Verify the CRITICAL error was logged
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({ customerId: 'cus_perp_safety' }),
      );
    });

    it('does NOT insert a license when userRow is null (no partial writes)', async () => {
      mockDbSelectChain.limit.mockResolvedValue([]);

      const event = makePerpetualEvent('evt_perp_no_partial_write');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // Only the idempotency insert should have been called — no license insert
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('clears the idempotency marker after the throw so Stripe can retry', async () => {
      mockDbSelectChain.limit.mockResolvedValue([]);

      const event = makePerpetualEvent('evt_perp_idem_clear');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // The error catch block calls unmarkProcessed (db.delete)
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });

    it('succeeds when userRow is found inside the transaction', async () => {
      // Inner transaction user lookup returns a valid row
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp_safety' }]);

      const event = makePerpetualEvent('evt_perp_success');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // idempotency insert + license insert = 2 inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const licenseValues = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(licenseValues.perpetual).toBe(true);
      expect(licenseValues.status).toBe('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Idempotency — same event ID processed twice
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Idempotency — duplicate event prevention', () => {
    it('returns { duplicate: true } when the same event is sent twice (duplicate key message)', async () => {
      const event = {
        id: 'evt_safety_idem_dup',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_idem', customer: 'cus_idem' } },
      };
      mockConstructEvent.mockReturnValue(event);

      const app = createApp();

      // First request succeeds
      const res1 = await app.request(postStripe(event));
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as Record<string, unknown>;
      expect(body1.received).toBe(true);
      expect(body1.duplicate).toBeUndefined();

      // Second request — DB insert fails with unique constraint
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "processed_webhook_events_pkey"'),
      );
      const res2 = await app.request(postStripe(event));
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as Record<string, unknown>;
      expect(body2.received).toBe(true);
      expect(body2.duplicate).toBe(true);
    });

    it('returns { duplicate: true } via PostgreSQL error code 23505', async () => {
      const event = {
        id: 'evt_safety_idem_pg',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_pg', customer: 'cus_pg' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const pgError = new Error('unique_violation');
      (pgError as unknown as Record<string, unknown>).code = '23505';
      mockDbInsertChain.values.mockRejectedValueOnce(pgError);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.duplicate).toBe(true);
    });

    it('does NOT execute business logic when event is a duplicate', async () => {
      const event = {
        id: 'evt_safety_idem_no_biz',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_dup', customer: 'cus_dup' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      // Simulate duplicate
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint'),
      );

      const app = createApp();
      await app.request(postStripe(event));

      // No license updates should happen
      expect(mockDb.update).not.toHaveBeenCalled();
      // No audit entries should be written
      expect(mockAuditAppend).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected DB errors (not duplicate key)', async () => {
      const event = {
        id: 'evt_safety_idem_err',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_err', customer: 'cus_err' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      // Non-duplicate DB error
      mockDbInsertChain.values.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Should return 500 so Stripe retries
      expect(res.status).toBe(500);
    });

    it('logs CRITICAL error on unexpected DB failure during idempotency check', async () => {
      const event = {
        id: 'evt_safety_idem_log',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_logfail', customer: 'cus_logfail' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      mockDbInsertChain.values.mockRejectedValueOnce(new Error('disk full'));

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('Idempotency check failed'),
        undefined,
        expect.objectContaining({ eventId: 'evt_safety_idem_log' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Missing webhook secret — returns 500
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Missing webhook secret', () => {
    it('returns 503 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;

      const app = createApp();
      const validBody = {
        id: 'evt_no_secret',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      const res = await app.request(postStripe(validBody, 't=123,v1=test'));

      expect(res.status).toBe(503);
    });

    it('does not attempt signature verification when secret is missing', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;

      const app = createApp();
      const validBody = {
        id: 'evt_no_secret2',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      await app.request(postStripe(validBody, 't=123,v1=test'));

      // constructEvent should not be called — the error happens before that
      expect(mockConstructEvent).not.toHaveBeenCalled();
    });

    it('succeeds when only STRIPE_WEBHOOK_SECRET_LIVE is set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_live_only';

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_live_only',
        type: 'payment_intent.created', // irrelevant event
        data: { object: {} },
      });

      const app = createApp();
      const validBody = {
        id: 'evt_live_only',
        type: 'payment_intent.created',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      const res = await app.request(postStripe(validBody, 'valid-sig'));

      expect(res.status).toBe(200);
      expect(mockConstructEvent).toHaveBeenCalledWith(
        expect.any(String),
        'valid-sig',
        'whsec_live_only',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Invalid signature — returns 400
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Invalid signature', () => {
    it('returns 400 when signature verification fails', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      const app = createApp();
      const validBody = {
        id: 'evt_bad_sig',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      const res = await app.request(postStripe(validBody, 'bad-sig'));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });

    it('returns 400 when Stripe-Signature header is missing entirely', async () => {
      const app = createApp();
      const req = new Request('http://localhost/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'evt_no_sig_header',
          type: 'test.event',
          data: { object: {} },
          created: 1700000000,
          livemode: false,
        }),
      });
      const res = await app.request(req);

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Missing Stripe-Signature');
    });

    it('logs the signature verification failure', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Signature mismatch');
      });

      const app = createApp();
      const validBody = {
        id: 'evt_forged',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      await app.request(postStripe(validBody, 'forged-sig'));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        undefined,
        expect.objectContaining({ detail: 'Signature mismatch' }),
      );
    });

    it('does not access the database when signature is invalid', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      const app = createApp();
      const validBody = {
        id: 'evt_bad',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      await app.request(postStripe(validBody, 'bad'));

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Webhook email functions — correct sendEmail calls
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Webhook email functions', () => {
    describe('sendLicenseActivatedEmail (subscription checkout)', () => {
      it('sends license activation email after successful checkout', async () => {
        mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_email_test' }]);

        const event = {
          id: 'evt_safety_email_license',
          type: 'checkout.session.completed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_email',
              customer: 'cus_email',
              customer_email: 'customer@test.com',
              metadata: { tier: 'pro', revealui_user_id: 'user_email_test' },
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        // Wait for fire-and-forget email
        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'customer@test.com',
                subject: expect.stringContaining('license is active'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });

      it('falls back to DB email lookup when customer_email is null', async () => {
        // Queue mock values for each sequential select().limit() call:
        // #1: transaction user check (tx.select users by stripeCustomerId)
        // #2: ensureHostedAccount → accountMemberships (no existing membership)
        // #3: ensureHostedAccount → users by id (user not found → returns null)
        // #4: resolveHostedAccountId → accountSubscriptions (no subscription)
        // #5: resolveHostedAccountId → users by stripeCustomerId (no user → returns null)
        // #6: findUserEmailByCustomerId → users (returns email for fallback)
        mockDbSelectChain.limit
          .mockResolvedValueOnce([{ id: 'user_fallback' }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ email: 'dbuser@test.com' }]);

        const event = {
          id: 'evt_safety_email_fallback',
          type: 'checkout.session.completed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_email2',
              customer: 'cus_email2',
              customer_email: null,
              metadata: { tier: 'max', revealui_user_id: 'user_fallback' },
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        await app.request(postStripe(event));

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'dbuser@test.com',
                subject: expect.stringContaining('license is active'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendPerpetualLicenseActivatedEmail', () => {
      it('sends perpetual license email with correct tier and support expiry', async () => {
        mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp_email' }]);

        const event = {
          id: 'evt_safety_email_perp',
          type: 'checkout.session.completed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              mode: 'payment',
              subscription: null,
              customer: 'cus_perp_email',
              customer_email: 'perp@customer.com',
              metadata: {
                tier: 'enterprise',
                revealui_user_id: 'user_perp_email',
              },
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'perp@customer.com',
                subject: expect.stringContaining('Perpetual License'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendPaymentFailedEmail (subscription.updated past_due)', () => {
      it('sends payment failed email when subscription goes past_due', async () => {
        // Queue mock values for each sequential select().limit() call:
        // #0: saga expire-license step: previous license status
        // #1: resolveHostedAccountId → accountSubscriptions (no subscription)
        // #2: resolveHostedAccountId → users by stripeCustomerId (no user → returns null, sync skipped)
        // #3: findUserEmailByCustomerId → users (returns email)
        mockDbSelectChain.limit
          .mockResolvedValueOnce([{ status: 'active' }]) // saga expire-license: previous status
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ email: 'pastdue@test.com' }]);

        const event = {
          id: 'evt_safety_email_pastdue',
          type: 'customer.subscription.updated',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              id: 'sub_pd',
              customer: 'cus_pd',
              status: 'past_due',
              metadata: {},
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'pastdue@test.com',
                subject: expect.stringContaining('payment failed'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendPaymentFailedEmail (invoice.payment_failed)', () => {
      it('sends payment failed email with customer_email from invoice', async () => {
        const event = {
          id: 'evt_safety_email_invfail',
          type: 'invoice.payment_failed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              id: 'inv_fail',
              customer: 'cus_invfail',
              customer_email: 'invoicefail@test.com',
              attempt_count: 1,
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'invoicefail@test.com',
                subject: expect.stringContaining('payment failed'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendTrialEndingEmail', () => {
      it('sends trial ending email with formatted date', async () => {
        const trialEnd = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;
        mockDbSelectChain.limit.mockResolvedValueOnce([{ email: 'trial@test.com' }]);

        const event = {
          id: 'evt_safety_email_trial',
          type: 'customer.subscription.trial_will_end',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              id: 'sub_trial',
              customer: 'cus_trial_email',
              trial_end: trialEnd,
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'trial@test.com',
                subject: expect.stringContaining('trial ends soon'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendPaymentRecoveredEmail', () => {
      it('sends payment recovered email after successful re-activation', async () => {
        mockSubscriptionsList.mockResolvedValueOnce({
          data: [{ id: 'sub_recovery', metadata: { tier: 'pro' } }],
        });
        mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'lic_expired', status: 'expired' }]);

        const event = {
          id: 'evt_safety_email_recovered',
          type: 'invoice.payment_succeeded',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              id: 'inv_recovered',
              customer: 'cus_recovered',
              customer_email: 'recovered@test.com',
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'recovered@test.com',
                subject: expect.stringContaining('restored'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('sendDisputeLostEmail', () => {
      it('sends dispute lost email when chargeback is decided against us', async () => {
        mockChargesRetrieve.mockResolvedValueOnce({
          id: 'ch_disp',
          customer: 'cus_disp_email',
        });
        // Queue mock values for each sequential select().limit() call:
        // #1: resolveHostedAccountId → accountSubscriptions (no subscription)
        // #2: resolveHostedAccountId → users by stripeCustomerId (no user → returns null, sync skipped)
        // #3: findUserEmailByCustomerId → users (returns email)
        mockDbSelectChain.limit
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ email: 'disputed@test.com' }]);

        const event = {
          id: 'evt_safety_email_dispute',
          type: 'charge.dispute.closed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              id: 'dp_lost',
              status: 'lost',
              charge: 'ch_disp',
              amount: 4900,
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        expect(res.status).toBe(200);

        await vi.waitFor(
          () => {
            expect(mockSendEmail).toHaveBeenCalledWith(
              expect.objectContaining({
                to: 'disputed@test.com',
                subject: expect.stringContaining('suspended'),
              }),
            );
          },
          { timeout: 1000 },
        );
      });
    });

    describe('Email failure resilience', () => {
      it('does not fail the webhook when email delivery fails', async () => {
        mockSendEmail.mockRejectedValueOnce(new Error('SMTP unreachable'));
        mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_emailfail' }]);

        const event = {
          id: 'evt_safety_email_fail_resilient',
          type: 'checkout.session.completed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_ef',
              customer: 'cus_ef',
              customer_email: 'fail@test.com',
              metadata: { tier: 'pro', revealui_user_id: 'user_emailfail' },
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        const res = await app.request(postStripe(event));

        // Webhook should still return 200 — email failures are non-blocking
        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.received).toBe(true);
      });

      it('logs a warning when email delivery fails', async () => {
        mockSendEmail.mockRejectedValue(new Error('SMTP down'));
        mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_warnlog' }]);

        const event = {
          id: 'evt_safety_email_warn_log',
          type: 'checkout.session.completed',
          created: 1700000000,
          livemode: false,
          data: {
            object: {
              mode: 'subscription',
              subscription: 'sub_wl',
              customer: 'cus_wl',
              customer_email: 'warnlog@test.com',
              metadata: { tier: 'pro', revealui_user_id: 'user_warnlog' },
            },
          },
        };
        mockConstructEvent.mockReturnValueOnce(event);

        const app = createApp();
        await app.request(postStripe(event));

        await vi.waitFor(
          () => {
            expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
              'Failed to send license activation email',
              undefined,
              expect.objectContaining({ detail: 'SMTP down' }),
            );
          },
          { timeout: 1000 },
        );
      });
    });
  });
});
