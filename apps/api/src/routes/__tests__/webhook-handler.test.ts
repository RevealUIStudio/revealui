/**
 * Stripe Webhook Handler  -  Comprehensive Handler Tests
 *
 * Supplements webhooks.test.ts and webhooks-expansion.test.ts with coverage for:
 * - Perpetual (one-time payment) checkout flow
 * - Scheduled cancellation (cancel_at_period_end + cancel_at)
 * - Tier resolution edge cases (each tier, unknown, missing)
 * - Missing REVEALUI_LICENSE_PRIVATE_KEY for subscription.updated active sync
 * - Customer/subscription ID resolution (string vs expanded object)
 * - PG error code 23505 idempotency path
 * - Unexpected DB errors during idempotency check
 * - resetLicenseState called at correct points
 * - Env var trimming (whitespace in secrets)
 * - PEM key newline normalization
 * - Error catch-all returns 500 with structured log
 * - Fast response verification
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();
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

vi.mock('../../lib/webhook-emails.js', () => ({
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

// ─── DB Mock ─────────────────────────────────────────────────────────────────

const mockAuditAppend = vi.fn();

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};
const mockDbInsertChain = { values: vi.fn() };
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
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

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': sig,
    },
    body: JSON.stringify(eventJson),
  });
}

function resetDbChains() {
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockResolvedValue([]);
  mockDbInsertChain.values.mockResolvedValue(undefined);
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDb.select.mockReturnValue(mockDbSelectChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook  -  handler tests', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-test-123');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_test', customer: 'cus_test' });
    mockAuditAppend.mockResolvedValue(undefined);

    resetDbChains();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.REVEALUI_LICENSE_PRIVATE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNATURE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Signature verification', () => {
    it('passes raw body and signature to constructEventAsync', async () => {
      const payload = {
        id: 'evt_sig',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_sig',
        type: 'unknown.event',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(postStripe(payload, 'test-sig'));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        JSON.stringify(payload),
        'test-sig',
        'whsec_placeholder',
      );
    });

    it('prefers STRIPE_WEBHOOK_SECRET_LIVE over STRIPE_WEBHOOK_SECRET', async () => {
      process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_live';

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_live',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(
        postStripe({
          id: 'evt_live',
          type: 'payment_intent.created',
          data: { object: {} },
          created: 1700000000,
          livemode: false,
        }),
      );

      expect(mockConstructEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'whsec_live',
      );
    });

    it('returns 400 with structured error when timestamp is stale', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Webhook timestamp is too old');
      });

      const app = createApp();
      const res = await app.request(
        postStripe(
          {
            id: 'evt_stale',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          },
          'stale',
        ),
      );

      expect(res.status).toBe(400);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        undefined,
        expect.objectContaining({ detail: expect.stringContaining('too old') }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Idempotency', () => {
    it('detects duplicate via PG error code 23505', async () => {
      const event = {
        id: 'evt_dedup_pg',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_test', customer: 'cus_test' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const pgError = new Error('unique violation');
      (pgError as unknown as Record<string, unknown>).code = '23505';
      mockDbInsertChain.values.mockRejectedValueOnce(pgError);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.duplicate).toBe(true);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected DB error during idempotency check', async () => {
      const event = {
        id: 'evt_dedup_err',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_test', customer: 'cus_test' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      mockDbInsertChain.values.mockRejectedValueOnce(new Error('connection refused'));

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERPETUAL CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkout.session.completed  -  perpetual', () => {
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
            customer: 'cus_perp',
            customer_email: 'perp@test.com',
            metadata: {
              tier: 'pro',
              perpetual: 'true',
              revealui_user_id: 'user_perp',
            },
            ...overrides,
          },
        },
      };
    }

    it('creates perpetual license with null expiresAt and subscriptionId', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp' }]);
      const event = makePerpetualEvent('evt_perp_create');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // idempotency + license
      const vals = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(vals.perpetual).toBe(true);
      expect(vals.expiresAt).toBeNull();
      expect(vals.subscriptionId).toBeNull();
      expect(vals.status).toBe('active');
    });

    it('sets supportExpiresAt to ~1 year from now', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp' }]);
      const event = makePerpetualEvent('evt_perp_support');
      mockConstructEvent.mockReturnValueOnce(event);

      const now = Date.now();
      const app = createApp();
      await app.request(postStripe(event));

      const vals = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      const supportExpiry = vals.supportExpiresAt as Date;
      expect(supportExpiry).toBeInstanceOf(Date);
      const expectedMs = now + 365 * 24 * 60 * 60 * 1000;
      expect(Math.abs(supportExpiry.getTime() - expectedMs)).toBeLessThan(10_000);
    });

    it('calls generateLicenseKey with perpetual:true and null expiresInSeconds', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp' }]);
      const event = makePerpetualEvent('evt_perp_keygen');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(licenseModule.generateLicenseKey)).toHaveBeenCalledWith(
        { tier: 'pro', customerId: 'cus_perp', perpetual: true },
        expect.any(String),
        null,
      );
    });

    it('skips when payment-mode checkout has no tier metadata', async () => {
      const event = makePerpetualEvent('evt_perp_skip', {
        metadata: {}, // no tier
      });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // only idempotency
    });

    it('stores githubUsername when present in metadata', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_perp' }]);
      const event = makePerpetualEvent('evt_perp_github', {
        metadata: {
          tier: 'pro',
          perpetual: 'true',
          revealui_user_id: 'user_perp',
          github_username: 'octocat',
        },
      });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const vals = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(vals.githubUsername).toBe('octocat');
    });

    it('returns 500 when user cannot be resolved', async () => {
      mockDbSelectChain.limit.mockResolvedValue([]);

      const event = makePerpetualEvent('evt_perp_nouser', {
        metadata: { tier: 'pro', perpetual: 'true' }, // no revealui_user_id
      });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
    });

    it('returns 500 when REVEALUI_LICENSE_PRIVATE_KEY is missing', async () => {
      delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

      const event = makePerpetualEvent('evt_perp_nokey');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED CANCELLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('subscription.updated  -  scheduled cancellation', () => {
    it('stamps expiresAt from cancel_at when cancel_at_period_end is true', async () => {
      const cancelAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const event = {
        id: 'evt_sched_cancel',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_sc',
            customer: 'cus_sc',
            status: 'active',
            cancel_at_period_end: true,
            cancel_at: cancelAt,
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // First update sets expiresAt, second updates active sync
      const firstSet = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(firstSet.expiresAt).toBeInstanceOf(Date);
      expect((firstSet.expiresAt as Date).getTime()).toBe(cancelAt * 1000);
    });

    it('skips expiresAt stamp when cancel_at is null', async () => {
      const event = {
        id: 'evt_sched_no_cancel_at',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_sc2',
            customer: 'cus_sc2',
            status: 'active',
            cancel_at_period_end: true,
            cancel_at: null,
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // cancel_at_period_end=true + cancel_at=null: no license update needed
      // (the cancel_at branch requires cancel_at, the active-sync branch requires !cancel_at_period_end)
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tier resolution edge cases', () => {
    function makeUpdatedEvent(
      id: string,
      metadata: Record<string, string>,
    ): Record<string, unknown> {
      return {
        id,
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_tier',
            customer: 'cus_tier',
            status: 'active',
            metadata,
          },
        },
      };
    }

    it('resolves pro tier', async () => {
      const event = makeUpdatedEvent('evt_tier_pro', { tier: 'pro' });
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('pro');
    });

    it('resolves max tier', async () => {
      const event = makeUpdatedEvent('evt_tier_max', { tier: 'max' });
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('max');
    });

    it('resolves enterprise tier', async () => {
      const event = makeUpdatedEvent('evt_tier_ent', { tier: 'enterprise' });
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      const set = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(set.tier).toBe('enterprise');
    });

    it('skips processing and logs error for unknown tier (no infinite retry)', async () => {
      const event = makeUpdatedEvent('evt_tier_bad', { tier: 'gold' });
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));
      // Returns 200 (webhook acknowledged) instead of 500 (which would trigger
      // infinite Stripe retries). The error is logged for operator investigation.
      expect(res.status).toBe(200);
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('tier metadata missing'),
        undefined,
        expect.objectContaining({ customerId: expect.any(String) }),
      );
    });

    it('skips processing when tier metadata is absent (no infinite retry)', async () => {
      const event = makeUpdatedEvent('evt_tier_none', {});
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING PRIVATE KEY FOR ACTIVE SYNC
  // ═══════════════════════════════════════════════════════════════════════════

  describe('subscription.updated  -  missing private key', () => {
    it('returns 500 when key missing and subscription is active', async () => {
      delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

      const event = {
        id: 'evt_nokey_active',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_nokey',
            customer: 'cus_nokey',
            status: 'active',
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER/SUBSCRIPTION ID RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Customer ID resolution', () => {
    it('handles customer as expanded object', async () => {
      const event = {
        id: 'evt_expanded_cust',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_exp',
            customer: { id: 'cus_expanded', object: 'customer' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('skips when customer is null', async () => {
      const event = {
        id: 'evt_null_cust',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_nc', customer: null } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESETLICENSESTATE CALLS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resetLicenseState', () => {
    it('called after subscription deletion', async () => {
      const event = {
        id: 'evt_reset_del',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_r', customer: 'cus_r' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      expect(vi.mocked(licenseModule.resetLicenseState)).toHaveBeenCalled();
    });

    it('called after subscription updated to past_due', async () => {
      const event = {
        id: 'evt_reset_pd',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_pd', customer: 'cus_pd', status: 'past_due' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      expect(vi.mocked(licenseModule.resetLicenseState)).toHaveBeenCalled();
    });

    it('preserves the existing hosted tier when subscription deletion metadata is missing', async () => {
      mockDbSelectChain.limit
        // Saga step: capture previous license status for compensation
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise' }])
        .mockResolvedValueOnce([{ id: 'acct_sub_1', planId: 'enterprise' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise', tier: 'enterprise' }]);

      const event = {
        id: 'evt_deleted_preserve_tier_missing_metadata',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_missing_meta',
            customer: 'cus_enterprise',
            metadata: {},
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[2]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('revoked');
    });

    it('preserves the existing hosted tier when past_due metadata is missing', async () => {
      mockDbSelectChain.limit
        // Saga step: capture previous license status for compensation
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise' }])
        .mockResolvedValueOnce([{ id: 'acct_sub_1', planId: 'enterprise' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise', tier: 'enterprise' }]);

      const event = {
        id: 'evt_past_due_preserve_tier_missing_metadata',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_past_due',
            customer: 'cus_enterprise',
            status: 'past_due',
            metadata: {},
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[2]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(accountSubscriptionUpdate.status).toBe('past_due');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('past_due');
    });

    it('called after customer deletion', async () => {
      const event = {
        id: 'evt_reset_custdel',
        type: 'customer.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'cus_cdel' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      expect(vi.mocked(licenseModule.resetLicenseState)).toHaveBeenCalled();
    });

    it('preserves the existing hosted tier when customer deletion revokes access', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise' }])
        .mockResolvedValueOnce([{ id: 'acct_sub_1', planId: 'enterprise' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise', tier: 'enterprise' }]);

      const event = {
        id: 'evt_reset_custdel_preserve_tier',
        type: 'customer.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'cus_enterprise' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[2]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('revoked');
    });

    it('called after full refund revocation', async () => {
      const event = {
        id: 'evt_reset_refund',
        type: 'charge.refunded',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'ch_ref',
            customer: 'cus_ref',
            amount: 4900,
            amount_refunded: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      expect(vi.mocked(licenseModule.resetLicenseState)).toHaveBeenCalled();
    });

    it('preserves the existing hosted tier when a full refund revokes access', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise' }])
        .mockResolvedValueOnce([{ id: 'acct_sub_1', planId: 'enterprise' }])
        .mockResolvedValueOnce([{ accountId: 'acct_enterprise', tier: 'enterprise' }]);

      const event = {
        id: 'evt_reset_refund_preserve_tier',
        type: 'charge.refunded',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'ch_ref_ent',
            customer: 'cus_enterprise',
            amount: 4900,
            amount_refunded: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const accountSubscriptionUpdate = mockDbUpdateChain.set.mock.calls[1]?.[0] as Record<
        string,
        unknown
      >;
      const entitlementUpdate = mockDbUpdateChain.set.mock.calls[2]?.[0] as Record<string, unknown>;
      expect(accountSubscriptionUpdate.planId).toBe('enterprise');
      expect(entitlementUpdate.tier).toBe('enterprise');
      expect(entitlementUpdate.status).toBe('revoked');
    });

    it('not called on partial refund', async () => {
      const event = {
        id: 'evt_noreset_partial',
        type: 'charge.refunded',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'ch_part',
            customer: 'cus_part',
            amount: 4900,
            amount_refunded: 1000,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      const app = createApp();
      await app.request(postStripe(event));
      expect(vi.mocked(licenseModule.resetLicenseState)).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ENV VAR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Environment variable handling', () => {
    it('trims whitespace from webhook secret', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = '  whsec_trimmed  ';

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_trim',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(
        postStripe({
          id: 'evt_trim',
          type: 'payment_intent.created',
          data: { object: {} },
          created: 1700000000,
          livemode: false,
        }),
      );

      expect(mockConstructEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'whsec_trimmed',
      );
    });

    it('normalizes escaped newlines in private key', async () => {
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'BEGIN\\nMIDDLE\\nEND';
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_n' }]);

      const event = {
        id: 'evt_newline',
        type: 'checkout.session.completed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_nl',
            customer: 'cus_nl',
            metadata: { tier: 'pro', revealui_user_id: 'user_n' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(licenseModule.generateLicenseKey)).toHaveBeenCalledWith(
        expect.any(Object),
        'BEGIN\nMIDDLE\nEND',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error handling', () => {
    it('catches handler errors and returns 500 with structured log', async () => {
      mockDbUpdateChain.where.mockRejectedValueOnce(new Error('DB down'));

      const event = {
        id: 'evt_catch',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_err', customer: 'cus_err' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Webhook processing failed');
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook handler error',
        undefined,
        expect.objectContaining({ eventType: 'customer.subscription.deleted' }),
      );
    });

    it('completes mock processing in under 1 second', async () => {
      const event = {
        id: 'evt_perf',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_f', customer: 'cus_f' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const start = performance.now();
      const res = await app.request(postStripe(event));
      const elapsed = performance.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
