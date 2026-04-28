/**
 * Stripe Webhook  -  payment_intent.requires_action (3DS / SCA, one-time charge variant)
 *
 * Sister test to webhook-payment-action-required.test.ts. The invoice
 * variant covers subscription billing 3DS challenges; this PaymentIntent
 * variant covers one-time charges (perpetual licenses, credit bundles,
 * support renewal) that need 3DS authentication.
 *
 * Critical semantics being verified:
 *
 *   1. payment_intent.requires_action is NOT a payment failure. It signals
 *      that the customer's bank returned a 3D Secure / SCA challenge on a
 *      one-time charge. The customer can recover by authenticating via
 *      next_action.redirect_to_url before Stripe's challenge expires (~24h).
 *
 *   2. We MUST NOT modify any DB state - the purchase hasn't completed yet,
 *      so there is no entitlement to freeze. The eventual webhook
 *      (payment_intent.succeeded via checkout.session.completed, OR
 *      payment_intent.payment_failed) drives state change.
 *
 *   3. We DO send a notification email so the customer knows to complete
 *      auth, and write an audit entry (compliance trail).
 *
 *   4. PaymentIntent has no customer_email field; the email is resolved
 *      via the users table lookup (findUserEmailByCustomerId).
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockConstructEvent,
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockSubscriptionsUpdate,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        retrieve: mockSubscriptionsRetrieve,
        list: mockSubscriptionsList,
        update: mockSubscriptionsUpdate,
      };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      list: mockSubscriptionsList,
      update: mockSubscriptionsUpdate,
    },
    customers: { update: vi.fn() },
    charges: { retrieve: vi.fn() },
  },
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

const mockSendPaymentActionRequiredEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/webhook-emails.js', () => ({
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentActionRequiredEmail: (...args: unknown[]) =>
    mockSendPaymentActionRequiredEmail(...args),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendTrialExpiredEmail: vi.fn().mockResolvedValue(undefined),
  sendCancellationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendGracePeriodStartedEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessedEmail: vi.fn().mockResolvedValue(undefined),
  sendSupportRenewalConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
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
const mockDbDeleteChain = { where: vi.fn().mockResolvedValue(undefined) };

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn().mockReturnValue(mockDbDeleteChain),
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
      let lastOutput: unknown;
      for (const step of steps) {
        lastOutput = await step.execute(ctx);
      }
      return {
        sagaId,
        status: 'completed',
        result: lastOutput,
        completedSteps: steps.map((s) => s.name),
        alreadyProcessed: false,
      };
    },
  ),
}));

// ─── Import under test ───────────────────────────────────────────────────────

import * as loggerModule from '@revealui/core/observability/logger';
import webhooksApp from '../webhooks.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  mockDbDeleteChain.where.mockResolvedValue(undefined);
  mockDb.select.mockReturnValue(mockDbSelectChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.delete.mockReturnValue(mockDbDeleteChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
}

function makeRequiresActionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_requires_action_test',
    type: 'payment_intent.requires_action',
    created: 1700000000,
    livemode: false,
    data: {
      object: {
        id: 'pi_test_requires_action',
        customer: 'cus_requires_action_test',
        amount: 4900,
        currency: 'usd',
        next_action: {
          type: 'redirect_to_url',
          redirect_to_url: {
            url: 'https://hooks.stripe.com/redirect/authenticate/abc123',
            return_url: 'https://example.com/return',
          },
        },
        ...overrides,
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook  -  payment_intent.requires_action (3DS/SCA, one-time)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockConstructEvent.mockReset();
    mockSendPaymentActionRequiredEmail.mockReset();
    mockSendPaymentActionRequiredEmail.mockResolvedValue(undefined);

    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockAuditAppend.mockResolvedValue(undefined);

    resetDbChains();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    savedEnv.REVEALUI_LICENSE_PRIVATE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    savedEnv.REVEALUI_ALERT_EMAIL = process.env.REVEALUI_ALERT_EMAIL;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_3ds_test';
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

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Acknowledgement
  // ──────────────────────────────────────────────────────────────────────────

  describe('Acknowledgement', () => {
    it('returns 200 with received: true on a valid event', async () => {
      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
    });

    it('skips processing entirely if customer ID is missing', async () => {
      const event = makeRequiresActionEvent({ customer: null });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockSendPaymentActionRequiredEmail).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Tier resolution + email lookup (PaymentIntent has no customer_email)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Tier resolution + email lookup', () => {
    it('resolves tier from licenses and email from users table', async () => {
      // Sequence:
      //   #1 - tier lookup from licenses (returns 'max')
      //   #2 - email lookup from users (findUserEmailByCustomerId)
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'max' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendPaymentActionRequiredEmail).toHaveBeenCalledWith(
            'customer@test.com',
            'max',
          );
        },
        { timeout: 1000 },
      );
    });

    it('defaults to "pro" tier when customer has no existing license (one-time first charge)', async () => {
      // Tier lookup returns empty (no license yet); email lookup succeeds
      mockDbSelectChain.limit
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ email: 'newcustomer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendPaymentActionRequiredEmail).toHaveBeenCalledWith(
            'newcustomer@test.com',
            'pro',
          );
        },
        { timeout: 1000 },
      );
    });

    it('does not send email when users lookup is empty (no recipient resolvable)', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]).mockResolvedValueOnce([]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockSendPaymentActionRequiredEmail).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CRITICAL: do NOT modify entitlement state on requires_action
  // ──────────────────────────────────────────────────────────────────────────

  describe('Entitlement state is NOT modified (one-time charge in flight)', () => {
    it('does not call db.update on the licenses table', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // CRITICAL: requires_action means the bank wants more auth, not that
      // the payment failed. The purchase has not completed; there is no
      // entitlement to freeze. The eventual succeeded/failed event will
      // drive any state change.
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('does not insert any new rows beyond the idempotency marker', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // Only the idempotency marker insert (processedWebhookEvents) is expected.
      // No license insert, no entitlement insert, no other writes.
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Audit trail
  // ──────────────────────────────────────────────────────────────────────────

  describe('Audit trail', () => {
    it('writes an audit entry with payment_intent.action_required event type', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockAuditAppend).toHaveBeenCalled();
      const found = mockAuditAppend.mock.calls.some((call) => {
        const entry = call[0] as { eventType?: string } | undefined;
        return entry?.eventType === 'payment_intent.action_required';
      });
      expect(found).toBe(true);
    });

    it('includes paymentIntentId + nextActionType in the audit payload', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const found = mockAuditAppend.mock.calls.some((call) => {
        const entry = call[0] as { payload?: Record<string, unknown> } | undefined;
        return (
          entry?.payload?.paymentIntentId === 'pi_test_requires_action' &&
          entry?.payload?.nextActionType === 'redirect_to_url'
        );
      });
      expect(found).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Email send resilience
  // ──────────────────────────────────────────────────────────────────────────

  describe('Email send resilience', () => {
    it('returns 200 even when payment-action-required email send fails', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);
      mockSendPaymentActionRequiredEmail.mockRejectedValueOnce(new Error('SMTP unreachable'));

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
    });

    it('logs an error referencing PaymentIntent when email send fails', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);
      mockSendPaymentActionRequiredEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
            expect.stringContaining('PaymentIntent'),
            undefined,
            expect.objectContaining({ detail: expect.stringContaining('SMTP down') }),
          );
        },
        { timeout: 1000 },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Logging
  // ──────────────────────────────────────────────────────────────────────────

  describe('Logging', () => {
    it('logs an info entry referencing 3DS/SCA + PaymentIntent on a valid event', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'customer@test.com' }]);

      const event = makeRequiresActionEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const found = vi
        .mocked(loggerModule.logger)
        .info.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            (call[0].includes('3DS') ||
              call[0].includes('SCA') ||
              call[0].includes('PaymentIntent') ||
              call[0].includes('authentication')),
        );
      expect(found).toBe(true);
    });
  });
});
