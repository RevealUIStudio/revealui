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

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockChargesRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    // Must use a class — webhooks.ts calls `new Stripe(key)`
    class {
      webhooks = { constructEvent: mockConstructEvent };
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
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn(),
  resetLicenseState: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── DB Mock — fluent chain for select / insert / update ─────────────────────

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
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import * as featuresModule from '@revealui/core/features';
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

describe('POST /stripe webhook — expansion events', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(featuresModule.isFeatureEnabled).mockReturnValue(false);
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
    mockDb.select.mockReturnValue(mockDbSelectChain);
    mockDb.insert.mockReturnValue(mockDbInsertChain);
    mockDb.update.mockReturnValue(mockDbUpdateChain);
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

    it('returns 200 without revoking license', async () => {
      const event = makePaymentFailedEvent('evt_pay_fail_2');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ─── customer.subscription.trial_will_end ────────────────────────────

  describe('customer.subscription.trial_will_end', () => {
    function makeTrialEndEvent(id: string, customerId = 'cus_trial') {
      return {
        id,
        type: 'customer.subscription.trial_will_end',
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

    it('logs a warning and writes audit entry when enabled', async () => {
      vi.mocked(featuresModule.isFeatureEnabled).mockReturnValue(true);

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

    it('does not revoke license when dispute is won', async () => {
      const event = makeDisputeClosedEvent('evt_disp_won_1', 'won');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('does not revoke when dispute status is warning_closed', async () => {
      const event = makeDisputeClosedEvent('evt_disp_warn_1', 'warning_closed');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('writes critical audit entry on lost dispute', async () => {
      vi.mocked(featuresModule.isFeatureEnabled).mockReturnValue(true);
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

    it('handles charge retrieval failure gracefully', async () => {
      mockChargesRetrieve.mockRejectedValueOnce(new Error('Stripe timeout'));

      const event = makeDisputeClosedEvent('evt_disp_charge_fail_1', 'lost');
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        'Failed to retrieve charge for lost dispute',
        undefined,
        expect.objectContaining({ chargeId: 'ch_disputed' }),
      );
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
        'Partial refund issued — license retained',
        expect.objectContaining({
          customerId: 'cus_refund',
          amountRefunded: 2000,
          amount: 4900,
        }),
      );
    });

    it('writes audit entry on full refund revocation', async () => {
      vi.mocked(featuresModule.isFeatureEnabled).mockReturnValue(true);

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
        // biome-ignore lint/suspicious/noExplicitAny: test — simulate null customer from Stripe
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
      vi.mocked(featuresModule.isFeatureEnabled).mockReturnValue(true);

      const event = {
        id: 'evt_pi_fail_1',
        type: 'payment_intent.payment_failed',
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
});
