/**
 * Stripe Webhook  -  invoice.payment_action_required (3DS / SCA)
 *
 * Coverage gap identified in GAP-124 surface 2 audit (2026-04-25):
 * the 3DS/SCA fix shipped in 54557b7cb / ab3b2da51 had no test
 * coverage. This file fills that gap.
 *
 * Critical semantics being verified:
 *
 *   1. payment_action_required is NOT a payment failure. It signals
 *      that the customer's bank returned a 3D Secure / SCA challenge
 *      and the customer can recover by authenticating on the hosted
 *      invoice URL.
 *
 *   2. Therefore we MUST NOT downgrade entitlement state on this
 *      event - that would be a premature degradation that violates
 *      the customer relationship.
 *
 *   3. We DO send a notification email (so the customer knows to
 *      complete authentication before Stripe's retry schedule
 *      escalates) and write an audit entry (for compliance trail).
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

// GAP-131: webhooks.ts now uses protectedStripe from @revealui/services
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

function makeActionRequiredEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_action_required_test',
    type: 'invoice.payment_action_required',
    created: 1700000000,
    livemode: false,
    data: {
      object: {
        id: 'in_test_action',
        customer: 'cus_action_test',
        customer_email: 'customer@test.com',
        hosted_invoice_url: 'https://invoice.stripe.com/i/abc123',
        ...overrides,
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook  -  invoice.payment_action_required (3DS/SCA)', () => {
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
      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
    });

    it('skips processing entirely if customer ID is missing', async () => {
      const event = makeActionRequiredEvent({ customer: null });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // The handler returns early via `break` on missing customerId.
      // Top-level handler still returns 200 to acknowledge to Stripe.
      expect(res.status).toBe(200);
      // No email should be sent
      expect(mockSendPaymentActionRequiredEmail).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Tier resolution
  // ──────────────────────────────────────────────────────────────────────────

  describe('Tier resolution from licenses table', () => {
    it('uses the resolved tier from licenses for the email when present', async () => {
      // First select() returns the tier row
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'max' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // Wait for fire-and-forget email
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

    it('defaults to "pro" tier when no license row is found', async () => {
      // Default empty array - no license found
      mockDbSelectChain.limit.mockResolvedValue([]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendPaymentActionRequiredEmail).toHaveBeenCalledWith(
            'customer@test.com',
            'pro',
          );
        },
        { timeout: 1000 },
      );
    });

    it('uses the resolved tier when license tier is "enterprise"', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'enterprise' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendPaymentActionRequiredEmail).toHaveBeenCalledWith(
            'customer@test.com',
            'enterprise',
          );
        },
        { timeout: 1000 },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Email fallback when invoice.customer_email is missing
  // ──────────────────────────────────────────────────────────────────────────

  describe('Email lookup', () => {
    it('falls back to users table lookup when invoice.customer_email is null', async () => {
      // Sequence:
      //   #1 - tier lookup from licenses
      //   #2 - email lookup from users (findUserEmailByCustomerId)
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }])
        .mockResolvedValueOnce([{ email: 'fallback@test.com' }]);

      const event = makeActionRequiredEvent({ customer_email: null });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendPaymentActionRequiredEmail).toHaveBeenCalledWith(
            'fallback@test.com',
            'pro',
          );
        },
        { timeout: 1000 },
      );
    });

    it('does not send email when both invoice.customer_email and users lookup are empty', async () => {
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }]) // tier lookup
        .mockResolvedValueOnce([]); // empty users lookup

      const event = makeActionRequiredEvent({ customer_email: null });
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // No email sent because there's no recipient
      expect(mockSendPaymentActionRequiredEmail).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CRITICAL: do not modify entitlement state on payment_action_required
  // ──────────────────────────────────────────────────────────────────────────

  describe('Entitlement state is NOT modified (3DS/SCA semantics)', () => {
    it('does not call db.update on the licenses table', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // CRITICAL: payment_action_required is NOT a failure.
      // The customer is in an SCA flow; downgrading them prematurely
      // would be a customer-experience regression.
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('does not insert any new rows beyond the idempotency marker', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // Only the idempotency marker insert (processedWebhookEvents) is expected.
      // No license insert, no entitlement insert, no other writes.
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Audit trail
  // ──────────────────────────────────────────────────────────────────────────

  describe('Audit trail', () => {
    it('writes an audit entry with payment.action_required event type', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // DrizzleAuditStore.append is called with a single object:
      //   { id, timestamp, eventType, severity, agentId, payload, policyViolations }
      expect(mockAuditAppend).toHaveBeenCalled();
      const found = mockAuditAppend.mock.calls.some((call) => {
        const entry = call[0] as { eventType?: string } | undefined;
        return entry?.eventType === 'payment.action_required';
      });
      expect(found).toBe(true);
    });

    it('includes hostedInvoiceUrl in the audit payload for operator visibility', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const found = mockAuditAppend.mock.calls.some((call) => {
        const entry = call[0] as { payload?: Record<string, unknown> } | undefined;
        return entry?.payload?.hostedInvoiceUrl === 'https://invoice.stripe.com/i/abc123';
      });
      expect(found).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Email send resilience
  // ──────────────────────────────────────────────────────────────────────────

  describe('Email send resilience', () => {
    it('returns 200 even when payment-action-required email send fails', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);
      mockSendPaymentActionRequiredEmail.mockRejectedValueOnce(new Error('SMTP unreachable'));

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Email failures must not block the webhook ack.
      expect(res.status).toBe(200);
    });

    it('logs an error when email send fails', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);
      mockSendPaymentActionRequiredEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
            expect.stringContaining('payment-action-required email'),
            undefined,
            expect.objectContaining({ detail: expect.stringContaining('SMTP down') }),
          );
        },
        { timeout: 1000 },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Logging
  // ──────────────────────────────────────────────────────────────────────────

  describe('Logging', () => {
    it('logs an info entry referencing 3DS/SCA on a valid event', async () => {
      mockDbSelectChain.limit.mockResolvedValueOnce([{ tier: 'pro' }]);

      const event = makeActionRequiredEvent();
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      // The handler logs an info entry naming the path explicitly.
      const found = vi
        .mocked(loggerModule.logger)
        .info.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            (call[0].includes('3DS') ||
              call[0].includes('SCA') ||
              call[0].includes('authentication')),
        );
      expect(found).toBe(true);
    });
  });
});
