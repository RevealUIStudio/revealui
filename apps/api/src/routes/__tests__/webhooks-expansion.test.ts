/**
 * Stripe Webhook Expansion Tests
 *
 * Covers event types NOT tested in webhooks.test.ts:
 * - invoice.payment_failed
 * - customer.subscription.trial_will_end
 * - customer.deleted
 * - charge.dispute.created
 * - charge.dispute.closed (won + lost)
 * - charge.refunded (full + partial)
 * - payment_intent.payment_failed
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const {
  mockConstructEvent,
  mockSubscriptionsUpdate,
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockChargesRetrieve,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockChargesRetrieve: vi.fn(),
}));

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

// GAP-131: webhooks.ts now uses protectedStripe from @revealui/services
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: {
      update: mockSubscriptionsUpdate,
      retrieve: mockSubscriptionsRetrieve,
      list: mockSubscriptionsList,
    },
    charges: { retrieve: mockChargesRetrieve },
    customers: { update: vi.fn() },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook  -  expansion events', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-test-123');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({
      status: 'active',
      trial_end: null,
    });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockChargesRetrieve.mockResolvedValue({
      id: 'ch_test',
      customer: 'cus_dispute',
    });
    mockAuditAppend.mockResolvedValue(undefined);

    // Re-wire fluent chain mocks
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

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key';
  });

  // ─── invoice.payment_failed ──────────────────────────────────────────

  describe('invoice.payment_failed', () => {
    function makePaymentFailedEvent(id: string, customerId = 'cus_fail', attemptCount = 1) {
      return {
        id,
        type: 'invoice.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'inv_fail',
            customer: customerId,
            customer_email: 'fail@test.com',
            attempt_count: attemptCount,
          },
        },
      };
    }

    it('logs a warning with customer and invoice details', async () => {
      const event = makePaymentFailedEvent('evt_pay_fail_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Invoice payment failed',
        expect.objectContaining({
          customerId: 'cus_fail',
          invoiceId: 'inv_fail',
          attemptCount: 1,
        }),
      );
    });

    it('returns 200 and syncs entitlements without revoking license', async () => {
      const event = makePaymentFailedEvent('evt_pay_fail_2');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // For initial failures (attempt_count=1), license should NOT be expired directly.
      // Entitlement sync happens via syncHostedSubscriptionState (sets past_due + graceUntil).
    });
  });

  // ─── customer.subscription.trial_will_end ────────────────────────────

  describe('customer.subscription.trial_will_end', () => {
    function makeTrialEndEvent(id: string, customerId = 'cus_trial') {
      return {
        id,
        type: 'customer.subscription.trial_will_end',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_trial',
            customer: customerId,
            trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
          },
        },
      };
    }

    it('logs trial ending info', async () => {
      const event = makeTrialEndEvent('evt_trial_end_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(vi.mocked(loggerModule.logger).info).toHaveBeenCalledWith(
        'Trial ending soon',
        expect.objectContaining({
          customerId: 'cus_trial',
          subscriptionId: 'sub_trial',
        }),
      );
    });

    it('does not revoke license', async () => {
      const event = makeTrialEndEvent('evt_trial_end_2');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── customer.deleted ────────────────────────────────────────────────

  describe('customer.deleted', () => {
    function makeCustomerDeletedEvent(id: string, customerId = 'cus_del') {
      return {
        id,
        type: 'customer.deleted',
        created: 1700000000,
        livemode: false,
        data: { object: { id: customerId } },
      };
    }

    it('revokes all licenses for the deleted customer', async () => {
      const event = makeCustomerDeletedEvent('evt_cust_del_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });
  });

  // ─── charge.dispute.created ──────────────────────────────────────────

  describe('charge.dispute.created', () => {
    function makeDisputeCreatedEvent(id: string) {
      return {
        id,
        type: 'charge.dispute.created',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'dp_created',
            charge: 'ch_disputed',
            amount: 4900,
            reason: 'fraudulent',
          },
        },
      };
    }

    it('logs a warning and writes audit entry', async () => {
      const event = makeDisputeCreatedEvent('evt_disp_created_1');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Chargeback dispute opened',
        expect.objectContaining({
          disputeId: 'dp_created',
          reason: 'fraudulent',
        }),
      );
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.dispute.opened');
    });

    it('does not revoke license (waits for dispute resolution)', async () => {
      const event = makeDisputeCreatedEvent('evt_disp_created_2');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── charge.dispute.closed ───────────────────────────────────────────

  describe('charge.dispute.closed', () => {
    function makeDisputeClosedEvent(id: string, status: string, chargeId = 'ch_disputed') {
      return {
        id,
        type: 'charge.dispute.closed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'dp_closed',
            status,
            charge: chargeId,
            amount: 4900,
          },
        },
      };
    }

    it('revokes license when dispute is lost', async () => {
      mockChargesRetrieve.mockResolvedValueOnce({
        id: 'ch_disputed',
        customer: 'cus_dispute',
      });

      const event = makeDisputeClosedEvent('evt_disp_lost_1', 'lost');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });

    it('restores revoked license when dispute is won', async () => {
      mockChargesRetrieve.mockResolvedValueOnce({
        id: 'ch_disputed',
        customer: 'cus_dispute',
      });

      const event = makeDisputeClosedEvent('evt_disp_won_1', 'won');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // License is restored to active on won disputes
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('restores revoked license when dispute status is warning_closed', async () => {
      mockChargesRetrieve.mockResolvedValueOnce({
        id: 'ch_disputed',
        customer: 'cus_dispute',
      });

      const event = makeDisputeClosedEvent('evt_disp_warn_1', 'warning_closed');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
    });

    it('writes critical audit entry on lost dispute', async () => {
      mockChargesRetrieve.mockResolvedValueOnce({
        id: 'ch_disputed',
        customer: 'cus_dispute',
      });

      const event = makeDisputeClosedEvent('evt_disp_lost_audit_1', 'lost');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.revoked.chargeback');
      expect(entry.severity).toBe('critical');
    });

    it('throws on charge retrieval failure so Stripe retries', async () => {
      mockChargesRetrieve.mockRejectedValueOnce(new Error('Stripe timeout'));

      const event = makeDisputeClosedEvent('evt_disp_charge_fail_1', 'lost');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      // Now throws (500) so Stripe retries  -  lost-dispute revocation must not be silently skipped
      expect(res.status).toBe(500);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── charge.refunded ─────────────────────────────────────────────────

  describe('charge.refunded', () => {
    function makeRefundedEvent(
      id: string,
      amount: number,
      amountRefunded: number,
      customerId = 'cus_refund',
    ) {
      return {
        id,
        type: 'charge.refunded',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'ch_refund',
            customer: customerId,
            amount,
            amount_refunded: amountRefunded,
          },
        },
      };
    }

    it('revokes license on full refund', async () => {
      const event = makeRefundedEvent('evt_refund_full_1', 4900, 4900);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });

    it('does not revoke license on partial refund', async () => {
      const event = makeRefundedEvent('evt_refund_partial_1', 4900, 1000);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('logs partial refund info without revoking', async () => {
      const event = makeRefundedEvent('evt_refund_partial_2', 4900, 2000);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(loggerModule.logger).info).toHaveBeenCalledWith(
        'Partial refund issued  -  license retained',
        expect.objectContaining({
          customerId: 'cus_refund',
          amountRefunded: 2000,
          amount: 4900,
        }),
      );
    });

    it('writes audit entry on full refund revocation', async () => {
      const event = makeRefundedEvent('evt_refund_full_audit_1', 4900, 4900);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.revoked.refund');
    });

    it('skips when customer ID is null', async () => {
      const event = makeRefundedEvent(
        'evt_refund_no_cust_1',
        4900,
        4900,
        // biome-ignore lint/suspicious/noExplicitAny: test  -  simulate null customer from Stripe
        null as any,
      );
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── payment_intent.payment_failed ───────────────────────────────────

  describe('payment_intent.payment_failed', () => {
    it('logs warning and writes audit entry', async () => {
      const event = {
        id: 'evt_pi_fail_1',
        type: 'payment_intent.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'pi_test',
            amount: 4900,
            currency: 'usd',
            last_payment_error: { message: 'Card declined' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Payment intent failed',
        expect.objectContaining({ paymentIntentId: 'pi_test' }),
      );
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('payment.intent.failed');
    });

    it('does not revoke license', async () => {
      const event = {
        id: 'evt_pi_fail_2',
        type: 'payment_intent.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'pi_test_2',
            amount: 4900,
            currency: 'usd',
            last_payment_error: null,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── Signature validation ─────────────────────────────────────────────

  describe('signature validation', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const app = createApp();
      const res = await app.request(
        new Request('http://localhost/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'evt_no_sig',
            type: 'some.event',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing stripe-signature/i);
    });

    it('returns 400 when signature verification fails', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });
      const app = createApp();
      const res = await app.request(
        postStripe(
          {
            id: 'evt_bad_sig',
            type: 'checkout.session.completed',
            data: { object: {} },
            created: 1700000000,
            livemode: false,
          },
          'bad-sig',
        ),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid webhook signature/i);
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('returns duplicate: true and skips processing on duplicate event', async () => {
      const event = {
        id: 'evt_idempotency_1',
        type: 'customer.subscription.trial_will_end',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'sub_idempotent',
            customer: 'cus_idempotent',
            trial_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);
      mockDbInsertChain.values.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
        }),
      );

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── invoice.payment_failed  -  suspension threshold ────────────────────

  describe('invoice.payment_failed  -  suspension on high attempt count', () => {
    it('expires license directly after 3+ failed attempts', async () => {
      const event = {
        id: 'evt_susp_1',
        type: 'invoice.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'inv_susp',
            customer: 'cus_susp',
            customer_email: 'susp@test.com',
            attempt_count: 3,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      // Direct license expiry happens for 3+ failures (before syncHostedSubscriptionState)
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDbUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' }),
      );
    });

    it('logs error when suspending after 3+ attempts', async () => {
      const event = {
        id: 'evt_susp_log_1',
        type: 'invoice.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'inv_susp_log',
            customer: 'cus_susp_log',
            customer_email: null,
            attempt_count: 4,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Payment failed 3+ times  -  suspending subscription',
        undefined,
        expect.objectContaining({ customerId: 'cus_susp_log', attemptCount: 4 }),
      );
    });

    it('skips update when customer ID is null', async () => {
      const event = {
        id: 'evt_pay_null_cust_1',
        type: 'invoice.payment_failed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'inv_null_cust',
            customer: null,
            customer_email: null,
            attempt_count: 1,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── charge.dispute.closed  -  null customer on lost dispute ───────────

  describe('charge.dispute.closed  -  null customer', () => {
    it('logs warning and skips revocation when charge has no customer', async () => {
      mockChargesRetrieve.mockResolvedValueOnce({
        id: 'ch_no_cust',
        customer: null,
      });

      const event = {
        id: 'evt_disp_no_cust_1',
        type: 'charge.dispute.closed',
        created: 1700000000,
        livemode: false,
        data: {
          object: {
            id: 'dp_no_cust',
            status: 'lost',
            charge: 'ch_no_cust',
            amount: 4900,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
        'Dispute charge has no customer  -  cannot revoke license',
        expect.objectContaining({ chargeId: 'ch_no_cust' }),
      );
    });
  });

  // ─── Irrelevant event types ───────────────────────────────────────────

  describe('irrelevant event types', () => {
    it('returns 200 without processing for unknown event types', async () => {
      const event = {
        id: 'evt_unknown_1',
        type: 'account.updated',
        created: 1700000000,
        livemode: false,
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.duplicate).toBeUndefined();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
