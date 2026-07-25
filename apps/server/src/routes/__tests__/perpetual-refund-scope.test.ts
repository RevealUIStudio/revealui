/**
 * A5: perpetual-refund revocation must never mass-revoke.
 *
 * charge.refunded previously fell back to revoking ALL of a customer's perpetual
 * licenses when the PaymentIntent metadata had no license_id — collateral
 * damage across concurrent perpetual purchases. These tests prove the fix:
 *   - refund WITH license_id  -> revokes exactly that one license
 *   - refund WITHOUT license_id -> revokes NOTHING (logged for manual review)
 *
 * Mirrors the webhook-handler.test.ts harness, adding paymentIntents + invoices
 * mocks. The charge carries no invoice, so resolveSubscriptionIdFromCharge
 * returns null and the subscription-revoke path is skipped — isolating the
 * perpetual branch as the only possible source of a status:'revoked' update.
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
  normalizePem: (raw: string) => raw.split('\\n').join('\n'),
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  generateLicenseKey: vi.fn().mockResolvedValue('rv-key'),
  resetLicenseState: vi.fn(),
  subscriptionLicenseExpiresInSeconds: vi.fn(() => 3600),
  subscriptionExpBound: vi.fn(() => 9_999_999_999),
  readLicenseExp: vi.fn(async () => null),
}));

vi.mock('@revealui/core/license/mint-client', () => ({
  canMintLicense: vi.fn(() => Boolean(process.env.REVEALUI_LICENSE_PRIVATE_KEY?.trim())),
  mintConfigMissingMessage: vi.fn(() => 'REVEALUI_LICENSE_PRIVATE_KEY not configured'),
  mintLicenseKey: vi.fn().mockResolvedValue('rv-key'),
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

function refundEvent(id: string) {
  return {
    id,
    type: 'charge.refunded',
    created: 1700000000,
    livemode: false,
    data: {
      object: {
        id: 'ch_perp',
        customer: 'cus_perp',
        amount: 14900,
        amount_refunded: 14900, // full refund
        currency: 'usd',
        payment_intent: 'pi_perp',
        invoice: null, // no subscription linkage
        billing_details: { email: null },
        receipt_email: null,
      },
    },
  };
}

const REVOKED_LOG = 'Perpetual license revoked: full refund issued';
const UNRESOLVED_LOG =
  'Perpetual refund missing license_id in PaymentIntent metadata  -  NOT revoking (manual review required)';

describe('charge.refunded  -  perpetual revocation scope (A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChains();
    mockAuditAppend.mockResolvedValue(undefined);
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
  });

  it('revokes EXACTLY the identified license when the PaymentIntent carries license_id', async () => {
    const event = refundEvent('evt_perp_refund_scoped');
    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_perp',
      metadata: { perpetual: 'true', license_id: 'lic_1', tier: 'pro' },
    });

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    // The perpetual-revoke path ran and named the SPECIFIC license id. (The
    // generic non-perpetual S2 revoke also fires on any full refund, so the
    // discriminator for the perpetual branch is this id-bearing log line.)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      REVOKED_LOG,
      expect.objectContaining({ perpetualLicenseId: 'lic_1' }),
    );
  });

  it('revokes NOTHING (no mass-revoke) when the PaymentIntent has no license_id', async () => {
    const event = refundEvent('evt_perp_refund_unscoped');
    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_perp',
      metadata: { perpetual: 'true', tier: 'pro' }, // NO license_id
    });

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    // The perpetual-revoke path must NOT fire — no mass-revoke of the customer's
    // perpetual licenses when the PaymentIntent lacks a license_id ...
    expect(mockLogger.warn).not.toHaveBeenCalledWith(REVOKED_LOG, expect.anything());
    // ... the unresolved case is logged for manual review instead.
    expect(mockLogger.error).toHaveBeenCalledWith(
      UNRESOLVED_LOG,
      undefined,
      expect.objectContaining({ customerId: 'cus_perp' }),
    );
  });
});
