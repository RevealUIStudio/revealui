/**
 * A3: refund -> revoke drill (TEST mode).
 *
 * Proves a clean license teardown on refund: a FULL charge.refunded flips the
 * customer's (non-perpetual) license ROW to status:'revoked' — the existing
 * webhook tests only assert resetLicenseState + the hosted entitlement, not the
 * licenses-row status itself. A PARTIAL refund must NOT revoke.
 *
 * The complementary half — that checkLicenseStatus then DENIES access within the
 * ~60s cache window (and re-queries after the TTL so revocation propagates) — is
 * already covered by middleware/__tests__/license-status.test.ts (the revoked
 * -> 403 case + the GAP-139 TTL freshness tests). Together they are the drill:
 * refund -> license row revoked -> access denied within the window.
 *
 * Harness mirrors perpetual-refund-scope.test.ts (adds paymentIntents/invoices
 * mocks + mockAuditAppend.mockResolvedValue so auditLicenseEvent's .catch works).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConstructEvent,
  mockChargesRetrieve,
  mockPaymentIntentsRetrieve,
  mockPaymentIntentsUpdate,
  mockInvoicesRetrieve,
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockSubscriptionsUpdate,
  mockSubscriptionsCancel,
  mockLogger,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockChargesRetrieve: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
  mockPaymentIntentsUpdate: vi.fn(),
  mockInvoicesRetrieve: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockSubscriptionsCancel: vi.fn(),
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const stripeShape = {
  webhooks: { constructEventAsync: mockConstructEvent },
  charges: { retrieve: mockChargesRetrieve },
  paymentIntents: { retrieve: mockPaymentIntentsRetrieve, update: mockPaymentIntentsUpdate },
  invoices: { retrieve: mockInvoicesRetrieve },
  subscriptions: {
    retrieve: mockSubscriptionsRetrieve,
    list: mockSubscriptionsList,
    update: mockSubscriptionsUpdate,
    cancel: mockSubscriptionsCancel,
  },
  customers: { update: vi.fn() },
};

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(class {} as unknown as (...args: unknown[]) => unknown),
}));
vi.mock('@revealui/services', () => ({ protectedStripe: stripeShape }));
vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));
vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn().mockResolvedValue('rv-key'),
  resetLicenseState: vi.fn(),
}));
vi.mock('@revealui/core/observability/logger', () => ({ logger: mockLogger }));
vi.mock('../../lib/webhook-emails.js', () => ({
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseRevokedEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendLivemodeMismatchAlert: vi.fn().mockResolvedValue(undefined),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

const mockAuditAppend = vi.fn();
const mockDbSelectChain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
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
  executeSaga: vi.fn(async () => ({ sagaId: 's', status: 'completed', result: {} })),
}));

import webhooksApp from '../webhooks.js';

function createApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}
function postStripe(eventJson: unknown) {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'sig' },
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
}

function refundEvent(id: string, amountRefunded: number) {
  return {
    id,
    type: 'charge.refunded',
    created: 1700000000,
    livemode: false,
    data: {
      object: {
        id: 'ch_sub',
        customer: 'cus_sub',
        amount: 4900,
        amount_refunded: amountRefunded,
        currency: 'usd',
        payment_intent: 'pi_sub',
        invoice: null, // no subscription linkage -> S2 falls back to all-non-perpetual revoke
        billing_details: { email: null },
        receipt_email: null,
      },
    },
  };
}

const FULL_REVOKE_LOG = 'License revoked: full refund issued';

describe('charge.refunded  -  subscription license teardown (A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChains();
    mockAuditAppend.mockResolvedValue(undefined);
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    // Non-perpetual charge: PI metadata carries no perpetual flag.
    mockPaymentIntentsRetrieve.mockResolvedValue({ id: 'pi_sub', metadata: {} });
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
  });

  it('flips the license ROW to revoked on a FULL refund', async () => {
    const event = refundEvent('evt_full_refund', 4900); // full
    mockConstructEvent.mockReturnValueOnce(event);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    // The non-perpetual license row is updated to status:'revoked' ...
    expect(mockDbUpdateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'revoked' }),
    );
    // ... and the full-refund revoke log fires.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      FULL_REVOKE_LOG,
      expect.objectContaining({ customerId: 'cus_sub' }),
    );
  });

  it('does NOT revoke on a PARTIAL refund', async () => {
    const event = refundEvent('evt_partial_refund', 1000); // partial (< amount)
    mockConstructEvent.mockReturnValueOnce(event);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    expect(mockDbUpdateChain.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'revoked' }),
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(FULL_REVOKE_LOG, expect.anything());
  });
});
