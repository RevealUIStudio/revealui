/**
 * B-1 — Perpetual license refund revokes license (P0 fix)
 *
 * Verifies that a charge.refunded event for a perpetual license purchase
 * (identified via payment_intent.metadata.perpetual='true') revokes the
 * matching license row and fires the revocation email.
 *
 * The old code explicitly excluded perpetual licenses from the refund-revoke
 * path with a comment "BLOCKING-A, tracked separately". This test confirms
 * the fix is in place.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockConstructEvent, mockPaymentIntentsRetrieve, mockInvoicesRetrieve } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
  mockInvoicesRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: vi.fn().mockResolvedValue({}),
        retrieve: vi.fn().mockResolvedValue({ status: 'active' }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        cancel: vi.fn().mockResolvedValue({}),
      };
      paymentIntents = { retrieve: mockPaymentIntentsRetrieve };
      invoices = { retrieve: mockInvoicesRetrieve };
      charges = { retrieve: vi.fn().mockResolvedValue({ customer: null }) };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: {
      update: vi.fn().mockResolvedValue({}),
      retrieve: vi.fn().mockResolvedValue({ status: 'active' }),
      list: vi.fn().mockResolvedValue({ data: [] }),
      cancel: vi.fn().mockResolvedValue({}),
    },
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
    invoices: { retrieve: mockInvoicesRetrieve },
    charges: { retrieve: vi.fn().mockResolvedValue({ customer: null }) },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn().mockResolvedValue('rv-test-key'),
  resetLicenseState: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockAuditAppend = vi.fn().mockResolvedValue(undefined);
const mockDbSelectChain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
const mockDbInsertChain = { values: vi.fn() };
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };
const mockDbDeleteChain = { where: vi.fn() };
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
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
      _name: string,
      _key: string,
      steps: Array<{
        execute: (ctx: {
          db: unknown;
          sagaId: string;
          checkpoint: () => Promise<void>;
        }) => Promise<unknown>;
      }>,
    ) => {
      const ctx = { db, sagaId: 'mock-saga', checkpoint: async () => {} };
      for (const step of steps) await step.execute(ctx);
      return { sagaId: 'mock-saga', status: 'completed', alreadyProcessed: false };
    },
  ),
}));

vi.mock('@revealui/db/schema', () => ({
  accounts: {
    id: 'accounts.id',
    name: 'accounts.name',
    slug: 'accounts.slug',
    status: 'accounts.status',
    createdAt: 'accounts.createdAt',
    updatedAt: 'accounts.updatedAt',
  },
  unreconciledWebhooks: {
    id: 'unreconciledWebhooks.id',
    eventId: 'unreconciledWebhooks.eventId',
    eventType: 'unreconciledWebhooks.eventType',
    payload: 'unreconciledWebhooks.payload',
    createdAt: 'unreconciledWebhooks.createdAt',
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
    planId: 'accountSubscriptions.planId',
    status: 'accountSubscriptions.status',
    updatedAt: 'accountSubscriptions.updatedAt',
    stripeCustomerId_: 'accountSubscriptions.stripeCustomerId',
    stripeSubscriptionId: 'accountSubscriptions.stripeSubscriptionId',
    currentPeriodStart: 'accountSubscriptions.currentPeriodStart',
    currentPeriodEnd: 'accountSubscriptions.currentPeriodEnd',
    cancelAtPeriodEnd: 'accountSubscriptions.cancelAtPeriodEnd',
  },
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    tier: 'accountEntitlements.tier',
    status: 'accountEntitlements.status',
    graceUntil: 'accountEntitlements.graceUntil',
    updatedAt: 'accountEntitlements.updatedAt',
  },
  licenses: {
    id: 'licenses.id',
    customerId: 'licenses.customerId',
    subscriptionId: 'licenses.subscriptionId',
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
    tier: 'licenses.tier',
    deletedAt: 'licenses.deletedAt',
    perpetual: 'licenses.perpetual',
  },
  processedWebhookEvents: {
    id: 'processedWebhookEvents.id',
    eventType: 'processedWebhookEvents.eventType',
    processedAt: 'processedWebhookEvents.processedAt',
  },
  users: {
    id: 'users.id',
    stripeCustomerId: 'users.stripeCustomerId',
    email: 'users.email',
    name: 'users.name',
  },
  agentCreditBalance: {
    userId: 'agentCreditBalance.userId',
    balance: 'agentCreditBalance.balance',
    totalPurchased: 'agentCreditBalance.totalPurchased',
    updatedAt: 'agentCreditBalance.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  or: vi.fn((...args: unknown[]) => `or(${args.join(',')})`),
  desc: vi.fn((_col: unknown) => `desc(${String(_col)})`),
  asc: vi.fn((_col: unknown) => `asc(${String(_col)})`),
  isNull: vi.fn((_col: unknown) => `isNull(${String(_col)})`),
  isNotNull: vi.fn((_col: unknown) => `isNotNull(${String(_col)})`),
  lt: vi.fn((_col: unknown, _val: unknown) => `lt(${String(_col)},${String(_val)})`),
  lte: vi.fn((_col: unknown, _val: unknown) => `lte(${String(_col)},${String(_val)})`),
  gt: vi.fn((_col: unknown, _val: unknown) => `gt(${String(_col)},${String(_val)})`),
  gte: vi.fn((_col: unknown, _val: unknown) => `gte(${String(_col)},${String(_val)})`),
  ne: vi.fn((_col: unknown, _val: unknown) => `ne(${String(_col)},${String(_val)})`),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => args),
    {
      join: vi.fn((...args: unknown[]) => args),
    },
  ),
  inArray: vi.fn((_col: unknown, _vals: unknown) => `inArray`),
  notInArray: vi.fn((_col: unknown, _vals: unknown) => `notInArray`),
  count: vi.fn(() => 'count()'),
  countDistinct: vi.fn((_col: unknown) => `countDistinct(${String(_col)})`),
}));

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  const DEFAULTS = {
    id: 'evt_test',
    type: 'test.event',
    data: { object: {} },
    created: 1700000000,
    livemode: false,
  };
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: JSON.stringify({ ...DEFAULTS, ...eventJson }),
  });
}

function makeChargeRefundedEvent(opts: {
  id?: string;
  customerId: string;
  paymentIntentId: string;
  amount: number;
  amountRefunded: number;
  billingEmail?: string | null;
}) {
  return {
    id: opts.id ?? 'evt_refund_test',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test',
        customer: opts.customerId,
        payment_intent: opts.paymentIntentId,
        amount: opts.amount,
        amount_refunded: opts.amountRefunded,
        currency: 'usd',
        billing_details: { email: opts.billingEmail ?? null },
        receipt_email: null,
      },
    },
    created: 1700000000,
    livemode: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────="────────────────

describe('charge.refunded — B-1 perpetual license revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
    mockDbSelectChain.limit.mockResolvedValue([]);
    mockDbInsertChain.values.mockResolvedValue(undefined);
    mockDbDeleteChain.where.mockResolvedValue({ rowCount: 1 });
    mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
    mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
    mockDb.select.mockReturnValue(mockDbSelectChain);
    mockDb.insert.mockReturnValue(mockDbInsertChain);
    mockDb.delete.mockReturnValue(mockDbDeleteChain);
    mockDb.update.mockReturnValue(mockDbUpdateChain);
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
      cb(mockDb),
    );

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-key';

    mockInvoicesRetrieve.mockResolvedValue({
      parent: { subscription_details: { subscription: null } },
    });
  });

  it('revokes perpetual license when charge.refunded is a full refund of a perpetual purchase', async () => {
    const event = makeChargeRefundedEvent({
      customerId: 'cus_perpetual',
      paymentIntentId: 'pi_perpetual',
      amount: 4299900,
      amountRefunded: 4299900,
      billingEmail: 'buyer@example.com',
    });

    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_perpetual',
      metadata: { perpetual: 'true', tier: 'enterprise', revealui_user_id: 'user-123' },
    });

    const app = createApp();
    const res = await app.request(postStripe(event));
    expect(res.status).toBe(200);

    expect(mockDb.update).toHaveBeenCalled();
    const updateSetArg = mockDbUpdateChain.set.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === 'revoked',
    );
    expect(updateSetArg).toBeDefined();
  });

  it('sends perpetual license revoked email when customer email is available', async () => {
    const event = makeChargeRefundedEvent({
      customerId: 'cus_perpetual_email',
      paymentIntentId: 'pi_perpetual_email',
      amount: 4299900,
      amountRefunded: 4299900,
      billingEmail: 'enterprise@example.com',
    });

    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_perpetual_email',
      metadata: { perpetual: 'true', tier: 'enterprise', revealui_user_id: 'user-456', license_id: 'lic-email-test' },
    });

    const app = createApp();
    await app.request(postStripe(event));

    const emailCall = mockSendEmail.mock.calls.find((call: unknown[]) => {
      const opts = call[0] as Record<string, unknown>;
      return (
        opts.to === 'enterprise@example.com' &&
        String(opts.subject).toLowerCase().includes('revoked')
      );
    });
    expect(emailCall).toBeDefined();
  });

  it('does NOT revoke perpetual license on partial refund', async () => {
    const event = makeChargeRefundedEvent({
      customerId: 'cus_partial',
      paymentIntentId: 'pi_partial',
      amount: 4299900,
      amountRefunded: 5000,
      billingEmail: null,
    });

    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_partial',
      metadata: { perpetual: 'true', tier: 'enterprise' },
    });

    const app = createApp();
    await app.request(postStripe(event));

    const revokeCall = mockDbUpdateChain.set.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === 'revoked',
    );
    expect(revokeCall).toBeUndefined();
  });

  it('still revokes non-perpetual license when PI metadata has no perpetual flag', async () => {
    const event = makeChargeRefundedEvent({
      customerId: 'cus_sub',
      paymentIntentId: 'pi_sub',
      amount: 4900,
      amountRefunded: 4900,
      billingEmail: null,
    });

    mockConstructEvent.mockReturnValueOnce(event);
    mockPaymentIntentsRetrieve.mockResolvedValueOnce({
      id: 'pi_sub',
      metadata: { tier: 'pro', revealui_user_id: 'user-789' },
    });

    const app = createApp();
    const res = await app.request(postStripe(event));
    expect(res.status).toBe(200);

    const revokeCall = mockDbUpdateChain.set.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === 'revoked',
    );
    expect(revokeCall).toBeDefined();
  });
});
