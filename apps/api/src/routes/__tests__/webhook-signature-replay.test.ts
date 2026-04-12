/**
 * Stripe Webhook  -  Signature Timing & Replay Protection Tests
 *
 * Supplements webhooks.test.ts with focused coverage for:
 * - Valid signature acceptance
 * - Invalid / tampered signatures
 * - Expired timestamp (Stripe SDK's 300s tolerance)
 * - Future timestamp rejection
 * - Missing Stripe-Signature header
 * - Empty request body
 * - Duplicate event handling (idempotency)
 * - Out-of-order events (subscription.updated before subscription.created)
 * - Unknown event types (gracefully ignored)
 * - Signature with wrong webhook secret
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
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
  getFeaturesForTier: vi.fn().mockReturnValue({}),
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

// ─── DB Mock  -  fluent chain for select / insert / update ─────────────────────

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

function postStripe(body: string, sig?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sig !== undefined) {
    headers['Stripe-Signature'] = sig;
  }
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers,
    body,
  });
}

function makeStripeSignature(timestamp: number, signature: string): string {
  return `t=${timestamp},v1=${signature}`;
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

/** Minimal body that satisfies the Stripe event envelope Zod schema */
const VALID_BODY = JSON.stringify({
  id: 'evt_test',
  type: 'test.event',
  data: { object: {} },
  created: 1700000000,
  livemode: false,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook  -  signature timing & replay protection', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockConstructEvent implementation to prevent persistent mockReturnValue
    // from leaking across tests (clearAllMocks only clears call history, not implementations)
    mockConstructEvent.mockReset();

    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-test-123');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockAuditAppend.mockResolvedValue(undefined);

    resetDbChains();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    savedEnv.REVEALUI_LICENSE_PRIVATE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
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
  // VALID SIGNATURE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Valid signature', () => {
    it('accepts a correctly signed webhook and returns 200', async () => {
      const payload = {
        id: 'evt_valid_sig',
        type: 'checkout.session.completed',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
      };
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_valid_sig',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'payment',
            subscription: null,
            customer: 'cus_test',
            metadata: {},
          },
        },
      });

      const app = createApp();
      const sig = makeStripeSignature(Math.floor(Date.now() / 1000), 'valid_hmac_hash');
      const res = await app.request(postStripe(JSON.stringify(payload), sig));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
    });

    it('passes raw body, signature header, and webhook secret to constructEventAsync', async () => {
      const payload = {
        id: 'evt_verify_args',
        type: 'test.event',
        data: { object: {} },
        created: 1700000000,
        livemode: false,
        test: 'verify-args',
      };
      const sig = 't=1234567890,v1=abc123';
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_args_check',
        type: 'unknown.event',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(postStripe(JSON.stringify(payload), sig));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        JSON.stringify(payload),
        sig,
        'whsec_test_secret',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVALID SIGNATURE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Invalid signature', () => {
    it('rejects a tampered payload with 400', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const app = createApp();
      const res = await app.request(
        postStripe(
          '{"id":"evt_tampered","type":"test.event","data":{"object":{}},"created":1700000000,"livemode":false,"tampered":true}',
          't=123,v1=tampered_sig',
        ),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });

    it('logs the verification failure with detail', async () => {
      const errorMsg = 'No signatures found matching the expected signature';
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error(errorMsg);
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=123,v1=bad'));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        undefined,
        expect.objectContaining({ detail: expect.stringContaining('No signatures found') }),
      );
    });

    it('rejects when signature format is malformed', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Unable to extract timestamp and signatures from header');
      });

      const app = createApp();
      const res = await app.request(postStripe(VALID_BODY, 'not-a-valid-sig-format'));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPIRED TIMESTAMP (REPLAY PROTECTION)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Expired timestamp', () => {
    it('rejects webhook with stale timestamp (Stripe 300s tolerance)', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        const err = new Error(
          'Webhook timestamp is too old. Received timestamp: 1609459200, current timestamp: 1709459800',
        );
        err.name = 'StripeSignatureVerificationError';
        throw err;
      });

      const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const sig = makeStripeSignature(staleTimestamp, 'stale_hash');
      const app = createApp();
      const res = await app.request(
        postStripe(
          JSON.stringify({
            id: 'evt_stale',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
          sig,
        ),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });

    it('logs stale timestamp detail for debugging', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Webhook timestamp is too old');
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=1000000,v1=old'));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        undefined,
        expect.objectContaining({ detail: expect.stringContaining('too old') }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE TIMESTAMP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Future timestamp', () => {
    it('rejects webhook with future timestamp beyond tolerance', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        const err = new Error(
          'Webhook timestamp is too new. Received timestamp: 1909459800, current timestamp: 1709459200',
        );
        err.name = 'StripeSignatureVerificationError';
        throw err;
      });

      const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
      const sig = makeStripeSignature(futureTimestamp, 'future_hash');
      const app = createApp();
      const res = await app.request(
        postStripe(
          JSON.stringify({
            id: 'evt_future',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
          sig,
        ),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });

    it('logs future timestamp error detail', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Webhook timestamp is too new');
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=9999999999,v1=future'));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        undefined,
        expect.objectContaining({ detail: expect.stringContaining('too new') }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING SIGNATURE HEADER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Missing signature header', () => {
    it('returns 400 when Stripe-Signature header is absent', async () => {
      const app = createApp();
      const res = await app.request(
        postStripe(
          JSON.stringify({
            id: 'evt_no_sig',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
        ),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Missing Stripe-Signature');
    });

    it('does not invoke constructEventAsync when header is missing', async () => {
      const app = createApp();
      await app.request(postStripe(VALID_BODY));

      expect(mockConstructEvent).not.toHaveBeenCalled();
    });

    it('returns 400 when Stripe-Signature header is empty string', async () => {
      const app = createApp();
      const res = await app.request(postStripe(VALID_BODY, ''));

      // Empty string is falsy, so the handler treats it as missing
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPTY BODY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Empty body', () => {
    it('rejects empty body with 400', async () => {
      // With @hono/zod-openapi, an empty body with Content-Type: application/json
      // triggers a JSON parse error before the handler runs, returning 400
      const app = createApp();
      const res = await app.request(postStripe('', 't=123,v1=empty'));

      expect(res.status).toBe(400);
    });

    it('does not invoke constructEventAsync for empty body (framework rejects first)', async () => {
      // The OpenAPI framework rejects the malformed JSON body before the handler
      // has a chance to call constructEvent
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Signature mismatch');
      });

      const app = createApp();
      await app.request(postStripe('', 't=123,v1=empty_body'));

      // constructEvent is NOT called because the framework rejects the body first
      expect(mockConstructEvent).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DUPLICATE EVENT HANDLING (IDEMPOTENCY)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Duplicate event handling', () => {
    it('processes first event and marks duplicate on second', async () => {
      const event = {
        id: 'evt_dup_test_001',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_dup', customer: 'cus_dup' } },
      };
      mockConstructEvent.mockReturnValue(event);

      const app = createApp();

      // First request  -  succeeds normally
      const res1 = await app.request(postStripe(JSON.stringify(event), 't=123,v1=first'));
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as Record<string, unknown>;
      expect(body1.duplicate).toBeUndefined();

      // Second request  -  DB insert throws unique constraint violation
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "processed_webhook_events_pkey"'),
      );

      const res2 = await app.request(postStripe(JSON.stringify(event), 't=124,v1=second'));
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as Record<string, unknown>;
      expect(body2.duplicate).toBe(true);
    });

    it('does not process business logic on duplicate event', async () => {
      const event = {
        id: 'evt_dup_skip_logic',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_dup2', customer: 'cus_dup2' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      // Simulate duplicate on first call (already processed by another region)
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint'),
      );

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(event), 't=123,v1=dup'));

      expect(res.status).toBe(200);
      // DB update (license revocation) should NOT be called for duplicates
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('detects duplicate via PostgreSQL error code 23505', async () => {
      const event = {
        id: 'evt_dup_pg_code',
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
      const res = await app.request(postStripe(JSON.stringify(event), 't=123,v1=pg'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.duplicate).toBe(true);
    });

    it('returns 500 on unexpected DB error during idempotency check', async () => {
      const event = {
        id: 'evt_db_error',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_err', customer: 'cus_err' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockDbInsertChain.values.mockRejectedValueOnce(new Error('connection timeout'));

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(event), 't=123,v1=err'));

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUT-OF-ORDER EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Out-of-order events', () => {
    it('processes subscription.updated before subscription.created', async () => {
      // subscription.updated arrives first (Stripe does not guarantee ordering)
      const updatedEvent = {
        id: 'evt_updated_first',
        type: 'customer.subscription.updated',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_ooo',
            customer: 'cus_ooo',
            status: 'active',
            metadata: { tier: 'pro' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(updatedEvent);

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(updatedEvent), 't=100,v1=updated'));

      // Handler should process successfully  -  it updates licenses by customer ID
      // regardless of whether subscription.created was seen first
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
    });

    it('processes subscription.deleted even if subscription.created was never received', async () => {
      const deletedEvent = {
        id: 'evt_deleted_no_created',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_orphan', customer: 'cus_orphan' } },
      };
      mockConstructEvent.mockReturnValueOnce(deletedEvent);

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(deletedEvent), 't=200,v1=deleted'));

      // Handler should still attempt revocation  -  update sets status=revoked
      // for all licenses matching the customer, which is a no-op if none exist
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });

    it('handles payment_succeeded before checkout.session.completed', async () => {
      // payment_succeeded arrives before the checkout was processed
      const paymentEvent = {
        id: 'evt_payment_before_checkout',
        type: 'invoice.payment_succeeded',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'inv_early',
            customer: 'cus_early',
            customer_email: null,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(paymentEvent);
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [{ id: 'sub_early', metadata: { tier: 'pro' } }],
      });
      // No existing license found  -  that's expected for out-of-order
      mockDbSelectChain.limit.mockResolvedValueOnce([]);

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(paymentEvent), 't=50,v1=early'));

      // Should complete without error  -  skips re-activation when no license exists
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UNKNOWN EVENT TYPES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Unknown event types', () => {
    it('returns 200 for unrecognized event types', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_unknown_type',
        type: 'balance.available',
        data: { object: {} },
      });

      const app = createApp();
      const res = await app.request(postStripe(VALID_BODY, 't=123,v1=unknown'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.received).toBe(true);
      // Should not attempt DB idempotency or processing for irrelevant events
      expect(body.duplicate).toBeUndefined();
    });

    it('does not attempt idempotency check for irrelevant events', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_irrelevant_no_db',
        type: 'payment_method.attached',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=123,v1=irrelevant'));

      // No DB operations should occur for non-relevant event types
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('does not log a warning for gracefully ignored events', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_graceful_ignore',
        type: 'source.chargeable',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=123,v1=grace'));

      expect(vi.mocked(loggerModule.logger).warn).not.toHaveBeenCalled();
      expect(vi.mocked(loggerModule.logger).error).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNATURE WITH WRONG SECRET
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Signature with wrong secret', () => {
    it('rejects when signed with a different webhook secret', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error(
          'No signatures found matching the expected signature for payload. ' +
            'Are you passing the raw request body you received from Stripe?',
        );
      });

      const app = createApp();
      const sig = makeStripeSignature(Math.floor(Date.now() / 1000), 'signed_with_wrong_whsec');
      const res = await app.request(
        postStripe(
          JSON.stringify({
            id: 'evt_wrong_secret',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
          sig,
        ),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Invalid webhook signature');
    });

    it('verifies constructEvent is called with the configured secret', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_correct_secret';

      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Signature mismatch');
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=123,v1=wrong'));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        VALID_BODY,
        't=123,v1=wrong',
        'whsec_correct_secret',
      );
    });

    it('uses STRIPE_WEBHOOK_SECRET_LIVE when available (production override)', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fallback';
      process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_live_production';

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_live_secret',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const app = createApp();
      await app.request(postStripe(VALID_BODY, 't=123,v1=live'));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        VALID_BODY,
        't=123,v1=live',
        'whsec_live_production',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING ENVIRONMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Missing environment configuration', () => {
    it('returns 503 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;

      const app = createApp();
      const res = await app.request(postStripe(VALID_BODY, 't=123,v1=nosecret'));

      expect(res.status).toBe(503);
    });

    it('uses cached Stripe client even when STRIPE_SECRET_KEY is removed (module-level cache)', async () => {
      // The Stripe client is cached at module level (let cachedStripe) after first use.
      // Deleting the env var after the client is cached does not cause a 500  -
      // the cached instance continues to work. This test verifies the caching behavior.
      delete process.env.STRIPE_SECRET_KEY;

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_cached_client',
        type: 'unknown.event',
        data: { object: {} },
      });

      const app = createApp();
      const res = await app.request(postStripe(VALID_BODY, 't=123,v1=nokey'));

      // Returns 200 because the cached Stripe client is reused
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBINED TIMING + REPLAY SCENARIOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Combined timing and replay scenarios', () => {
    it('rejects replay of a valid event with tampered timestamp', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const app = createApp();
      // Attacker replays a captured event with a fresh timestamp but
      // cannot recompute the HMAC, so signature verification fails
      const replayedSig = makeStripeSignature(
        Math.floor(Date.now() / 1000),
        'replayed_original_hmac',
      );
      const res = await app.request(
        postStripe(
          JSON.stringify({
            id: 'evt_replay_attack',
            type: 'test.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
          replayedSig,
        ),
      );

      expect(res.status).toBe(400);
    });

    it('DB idempotency catches replay even if signature somehow passes', async () => {
      // Hypothetical: same event signature is valid (e.g., within Stripe retry window)
      // but the event was already processed
      const event = {
        id: 'evt_already_processed',
        type: 'customer.subscription.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: 'sub_replay', customer: 'cus_replay' } },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      // DB rejects because event was already processed
      mockDbInsertChain.values.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "processed_webhook_events_pkey"'),
      );

      const app = createApp();
      const res = await app.request(postStripe(JSON.stringify(event), 't=123,v1=replay'));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.duplicate).toBe(true);
      // Business logic should NOT execute
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('multiple Stripe error types all result in 400', async () => {
      const errorMessages = [
        'No signatures found matching the expected signature for payload',
        'Webhook timestamp is too old',
        'Unable to extract timestamp and signatures from header',
        'Unexpected webhook payload type',
      ];

      const app = createApp();

      for (const msg of errorMessages) {
        vi.clearAllMocks();
        resetDbChains();

        mockConstructEvent.mockImplementationOnce(() => {
          throw new Error(msg);
        });

        const res = await app.request(postStripe(VALID_BODY, `t=123,v1=test_${msg.length}`));
        expect(res.status).toBe(400);
      }
    });
  });
});
