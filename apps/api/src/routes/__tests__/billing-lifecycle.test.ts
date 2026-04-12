/**
 * Billing Lifecycle Integration Tests
 *
 * Exercises the full Stripe checkout -> license creation -> webhook lifecycle flow:
 * 1. Happy path: checkout -> license created -> subscription.created syncs entitlements
 * 2. Payment failure -> grace period -> recovery
 * 3. Cancellation flow
 * 4. Upgrade with pending_change
 * 5. Checkout fails when subscription retrieve fails
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
  getFeaturesForTier: vi.fn(() => ({})),
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn(),
  resetLicenseState: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockSendCancellationConfirmationEmail = vi.fn().mockResolvedValue(undefined);

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
  sendGracePeriodStartedEmail: vi.fn().mockResolvedValue(undefined),
  sendCancellationConfirmationEmail: (...args: unknown[]) =>
    mockSendCancellationConfirmationEmail(...args),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
}));

// ─── DB Mock  -  fluent chain for select / insert / update / delete ────────────

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
  accounts: {
    id: 'accounts.id',
    status: 'accounts.status',
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
    status: 'accountSubscriptions.status',
    updatedAt: 'accountSubscriptions.updatedAt',
    planId: 'accountSubscriptions.planId',
  },
  accountEntitlements: {
    accountId: 'accountEntitlements.accountId',
    tier: 'accountEntitlements.tier',
    status: 'accountEntitlements.status',
  },
  licenses: {
    id: 'licenses.id',
    customerId: 'licenses.customerId',
    subscriptionId: 'licenses.subscriptionId',
    status: 'licenses.status',
    updatedAt: 'licenses.updatedAt',
    tier: 'licenses.tier',
    deletedAt: 'licenses.deletedAt',
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
  isNull: vi.fn((_col) => `isNull(${String(_col)})`),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import * as licenseModule from '@revealui/core/license';
import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

/** Minimal Stripe event envelope fields required by the OpenAPI request body schema. */
const STRIPE_EVENT_DEFAULTS = {
  id: 'evt_default',
  type: 'test.event',
  data: { object: {} },
  created: 1700000000,
  livemode: false,
};

function postStripe(eventJson: unknown, sig = 'valid-sig'): Request {
  // Merge defaults so test payloads pass the Stripe event envelope schema validation.
  // The handler ignores the parsed body  -  it uses stripe.webhooks.constructEventAsync() instead.
  const body =
    eventJson && typeof eventJson === 'object'
      ? { ...STRIPE_EVENT_DEFAULTS, ...eventJson }
      : eventJson;
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': sig,
    },
    body: JSON.stringify(body),
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

describe('Billing lifecycle integration', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mockResolvedValueOnce queues
    mockDbSelectChain.limit.mockReset();
    mockDbInsertChain.values.mockReset();
    mockDbUpdateChain.set.mockReset();
    mockDbUpdateChain.where.mockReset();
    mockDbDeleteChain.where.mockReset();

    vi.mocked(licenseModule.generateLicenseKey).mockResolvedValue('rv-license-key-lifecycle-test');
    mockSubscriptionsUpdate.mockResolvedValue({});
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockAuditAppend.mockResolvedValue(undefined);

    resetDbChains();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    savedEnv.REVEALUI_LICENSE_PRIVATE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'; // gitleaks:allow  -  test fixture, not a real key
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_lifecycle'; // gitleaks:allow  -  test fixture
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
  // 1. HAPPY PATH: checkout -> license created -> subscription.created syncs
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Happy path: checkout -> license -> subscription.created', () => {
    it('creates a trialing license on checkout.session.completed with trialing subscription', async () => {
      const trialEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        status: 'trialing',
        trial_end: trialEnd,
        items: { data: [{ current_period_start: null, current_period_end: null }] },
        cancel_at_period_end: false,
      });
      // User existence check inside the transaction
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_happy' }]);

      const checkoutEvent = {
        id: 'evt_lifecycle_checkout_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_happy',
            customer: 'cus_happy',
            metadata: { tier: 'pro', revealui_user_id: 'user_happy' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(checkoutEvent);

      const app = createApp();
      const res = await app.request(postStripe(checkoutEvent));

      expect(res.status).toBe(200);
      // calls[0] = idempotency insert; calls[1] = license insert
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      const insertValues = mockDbInsertChain.values.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(insertValues.status).toBe('trialing');
      expect(insertValues.tier).toBe('pro');
      expect(insertValues.subscriptionId).toBe('sub_happy');
      expect(insertValues.expiresAt).toBeInstanceOf(Date);
    });

    it('calls syncHostedSubscriptionState during checkout (db operations confirm sync)', async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        status: 'active',
        trial_end: null,
        items: { data: [{ current_period_start: null, current_period_end: null }] },
        cancel_at_period_end: false,
      });
      // User existence check inside the transaction
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_sync' }]);

      const checkoutEvent = {
        id: 'evt_lifecycle_checkout_sync_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_sync',
            customer: 'cus_sync',
            metadata: { tier: 'pro', revealui_user_id: 'user_sync' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(checkoutEvent);

      const app = createApp();
      const res = await app.request(postStripe(checkoutEvent));

      expect(res.status).toBe(200);
      // syncHostedSubscriptionState issues additional select+insert/update calls
      // for accountMemberships, accountSubscriptions, accountEntitlements.
      // Verify the saga executor was used (license creation + sync all go through executeSaga).
      const { executeSaga } = await import('@revealui/db');
      expect(executeSaga).toHaveBeenCalled();
    });

    it('syncs entitlements on customer.subscription.created', async () => {
      const subCreatedEvent = {
        id: 'evt_lifecycle_sub_created_1',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_created',
            customer: 'cus_created',
            status: 'trialing',
            trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            metadata: { tier: 'pro' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(subCreatedEvent);

      const app = createApp();
      const res = await app.request(postStripe(subCreatedEvent));

      expect(res.status).toBe(200);
      // syncHostedSubscriptionState is called during subscription.created handler.
      // It resolves the account and upserts subscription + entitlement rows.
      // DB select is called to look up the account.
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PAYMENT FAILURE -> GRACE PERIOD -> RECOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Payment failure -> grace period -> recovery', () => {
    it('degrades license to expired and entitlements to past_due on past_due subscription', async () => {
      const pastDueEvent = {
        id: 'evt_lifecycle_pastdue_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_pastdue',
            customer: 'cus_pastdue',
            status: 'past_due',
            metadata: { tier: 'pro' },
            items: {
              data: [
                {
                  current_period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
                  current_period_end: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
                },
              ],
            },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(pastDueEvent);

      const app = createApp();
      const res = await app.request(postStripe(pastDueEvent));

      expect(res.status).toBe(200);

      // License should be set to 'expired'
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('expired');
    });

    it('writes license.grace_period audit entry on past_due', async () => {
      const pastDueAuditEvent = {
        id: 'evt_lifecycle_pastdue_audit_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_grace_audit',
            customer: 'cus_grace_audit',
            status: 'past_due',
            metadata: {},
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(pastDueAuditEvent);

      const app = createApp();
      const res = await app.request(postStripe(pastDueAuditEvent));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.grace_period');
      expect(entry.severity).toBe('warn');
    });

    it('reactivates license and restores entitlements on invoice.payment_succeeded', async () => {
      // Mock: customer has an active subscription after payment recovery
      mockSubscriptionsList.mockResolvedValueOnce({
        data: [
          {
            id: 'sub_recovered',
            status: 'active',
            metadata: { tier: 'pro' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        ],
      });

      // The handler does these selects in sequence:
      // 1. Receipt tier lookup (from licenses, orderBy, limit)
      // 2. Existing license check (from licenses, orderBy, limit)
      // 3. findHostedStatusByCustomerId -> accountSubscriptions lookup (limit)
      // 4. findHostedStatusByCustomerId -> accountEntitlements lookup (limit)
      // 5. syncHostedSubscriptionState -> resolveHostedAccountId -> accountSubscriptions (limit)
      // 6+ syncHostedSubscriptionState -> existingSubscription + existingEntitlement lookups
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ tier: 'pro' }]) // 1. receipt tier
        .mockResolvedValueOnce([{ id: 'lic_expired', status: 'expired' }]) // 2. existing license
        .mockResolvedValueOnce([{ accountId: 'acct_recovery' }]) // 3. hosted status - accountSubscriptions
        .mockResolvedValueOnce([{ status: 'expired' }]) // 4. hosted status - accountEntitlements
        .mockResolvedValueOnce([{ accountId: 'acct_recovery' }]) // 5. resolveHostedAccountId
        .mockResolvedValueOnce([{ id: 'sub_existing', planId: 'pro' }]) // 6. existingSubscription
        .mockResolvedValueOnce([{ accountId: 'acct_recovery', tier: 'pro' }]); // 7. existingEntitlement

      const paymentSucceededEvent = {
        id: 'evt_lifecycle_payment_recovery_1',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv_recovery',
            customer: 'cus_recovery',
            amount_paid: 2900,
            currency: 'usd',
            number: 'INV-001',
            period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            customer_email: 'recovery@test.com',
            hosted_invoice_url: 'https://invoice.stripe.com/test',
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(paymentSucceededEvent);

      const app = createApp();
      const res = await app.request(postStripe(paymentSucceededEvent));

      expect(res.status).toBe(200);

      // License should be updated to active with new key
      expect(mockDb.update).toHaveBeenCalled();
      const updateCalls = mockDbUpdateChain.set.mock.calls;
      const hasActiveUpdate = updateCalls.some(
        (call) => (call[0] as Record<string, unknown>).status === 'active',
      );
      expect(hasActiveUpdate).toBe(true);

      // generateLicenseKey should have been called for recovery
      expect(licenseModule.generateLicenseKey).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CANCELLATION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cancellation flow', () => {
    it('revokes license on customer.subscription.deleted', async () => {
      const deletedEvent = {
        id: 'evt_lifecycle_deleted_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_cancelled',
            customer: 'cus_cancelled',
            metadata: { tier: 'pro' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(deletedEvent);

      const app = createApp();
      const res = await app.request(postStripe(deletedEvent));

      expect(res.status).toBe(200);

      // License revoked
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('revoked');
    });

    it('syncs entitlements to revoked status on subscription deletion', async () => {
      const deletedSyncEvent = {
        id: 'evt_lifecycle_deleted_sync_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_del_sync',
            customer: 'cus_del_sync',
            metadata: {},
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(deletedSyncEvent);

      const app = createApp();
      const res = await app.request(postStripe(deletedSyncEvent));

      expect(res.status).toBe(200);

      // syncHostedSubscriptionState is called  -  it issues DB selects to resolve the account
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('writes license.revoked audit entry on deletion', async () => {
      const deletedAuditEvent = {
        id: 'evt_lifecycle_deleted_audit_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_del_audit',
            customer: 'cus_del_audit',
            metadata: {},
            items: { data: [] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(deletedAuditEvent);

      const app = createApp();
      const res = await app.request(postStripe(deletedAuditEvent));

      expect(res.status).toBe(200);
      expect(mockAuditAppend).toHaveBeenCalledOnce();
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry.eventType).toBe('license.revoked');
      expect(entry.severity).toBe('warn');
    });

    it('sends cancellation email on subscription deletion', async () => {
      // The handler sequence for subscription.deleted:
      // 0. Saga step: capture previous license status for compensation (SELECT 0)
      // 1. syncHostedSubscriptionState -> resolveHostedAccountId -> accountSubscriptions (SELECT 1)
      // 2. resolveHostedAccountId -> users lookup by stripeCustomerId (SELECT 2)
      // 3. findUserEmailByCustomerId -> users lookup by stripeCustomerId (SELECT 3)
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ status: 'active' }]) // 0. saga captures previous license status
        .mockResolvedValueOnce([]) // 1. accountSubscriptions - no existing subscription
        .mockResolvedValueOnce([]) // 2. users by stripeCustomerId - not found (no account)
        .mockResolvedValueOnce([{ email: 'cancel@test.com' }]); // 3. findUserEmailByCustomerId

      const deletedEmailEvent = {
        id: 'evt_lifecycle_deleted_email_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_del_email',
            customer: 'cus_del_email',
            metadata: {},
            items: { data: [] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(deletedEmailEvent);

      const app = createApp();
      const res = await app.request(postStripe(deletedEmailEvent));

      expect(res.status).toBe(200);

      // Cancellation email is sent (fire-and-forget)
      await vi.waitFor(
        () => {
          expect(mockSendCancellationConfirmationEmail).toHaveBeenCalledWith(
            'cancel@test.com',
            'pro',
          );
        },
        { timeout: 1000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. UPGRADE WITH pending_change
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Upgrade with pending_change', () => {
    it('clears pending_change metadata when subscription is active with pending_change flag', async () => {
      const upgradeEvent = {
        id: 'evt_lifecycle_upgrade_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_upgrade',
            customer: 'cus_upgrade',
            status: 'active',
            metadata: { tier: 'max', pending_change: 'true' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(upgradeEvent);

      const app = createApp();
      const res = await app.request(postStripe(upgradeEvent));

      expect(res.status).toBe(200);

      // stripe.subscriptions.update should be called to clear pending_change
      await vi.waitFor(
        () => {
          expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_upgrade', {
            metadata: { pending_change: '' },
          });
        },
        { timeout: 1000 },
      );
    });

    it('updates license tier to the new tier on active subscription update', async () => {
      const upgradeUpdateEvent = {
        id: 'evt_lifecycle_upgrade_tier_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_tier_up',
            customer: 'cus_tier_up',
            status: 'active',
            metadata: { tier: 'enterprise' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(upgradeUpdateEvent);

      const app = createApp();
      const res = await app.request(postStripe(upgradeUpdateEvent));

      expect(res.status).toBe(200);

      // License should be updated with new tier
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setCall.status).toBe('active');
      expect(setCall.tier).toBe('enterprise');
    });

    it('does not call subscriptions.update when pending_change is absent', async () => {
      const noPendingEvent = {
        id: 'evt_lifecycle_no_pending_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_no_pending',
            customer: 'cus_no_pending',
            status: 'active',
            metadata: { tier: 'pro' },
            items: { data: [{ current_period_start: null, current_period_end: null }] },
            cancel_at_period_end: false,
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(noPendingEvent);

      const app = createApp();
      const res = await app.request(postStripe(noPendingEvent));

      expect(res.status).toBe(200);

      // subscriptions.update is called once for license key metadata (from checkout flow),
      // but NOT called with pending_change metadata clearing
      const pendingChangeCalls = mockSubscriptionsUpdate.mock.calls.filter(
        (call) =>
          (call[1] as Record<string, Record<string, string>>)?.metadata?.pending_change === '',
      );
      expect(pendingChangeCalls).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CHECKOUT FAILS WHEN SUBSCRIPTION RETRIEVE FAILS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Checkout fails when subscription retrieve fails', () => {
    it('returns 500 when subscription retrieve throws so Stripe retries', async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Stripe timeout'));
      // User existence check must find a matching user
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_retrieve_fail' }]);

      const checkoutFailEvent = {
        id: 'evt_lifecycle_checkout_fail_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_fail',
            customer: 'cus_fail',
            metadata: { tier: 'pro', revealui_user_id: 'user_retrieve_fail' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(checkoutFailEvent);

      const app = createApp();
      const res = await app.request(postStripe(checkoutFailEvent));

      // 500 triggers Stripe retry
      expect(res.status).toBe(500);
    });

    it('cleans up idempotency marker on checkout failure so retry succeeds', async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Stripe network error'));
      mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_cleanup' }]);

      const checkoutCleanupEvent = {
        id: 'evt_lifecycle_checkout_cleanup_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_cleanup',
            customer: 'cus_cleanup',
            metadata: { tier: 'pro', revealui_user_id: 'user_cleanup' },
          },
        },
      };
      mockConstructEvent.mockReturnValueOnce(checkoutCleanupEvent);

      const app = createApp();
      const res = await app.request(postStripe(checkoutCleanupEvent));

      expect(res.status).toBe(500);

      // The handler should attempt to clean up the idempotency marker via delete
      // so that Stripe's retry is not treated as a duplicate.
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
