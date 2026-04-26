/**
 * Billing Webhook Integration Tests
 *
 * Uses PGlite (in-memory Postgres) with real Drizzle ORM queries.
 * Verifies actual DB state transitions for Stripe webhook events.
 *
 * Stripe signature verification and emails are mocked.
 * Everything else  -  DB queries, idempotency, saga execution  -  is real.
 */

import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedTestUser,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: vi.fn(),
        retrieve: mockSubscriptionsRetrieve,
        list: vi.fn().mockResolvedValue({ data: [] }),
      };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const { DrizzleAuditStore: RealAuditStore, executeSaga: realExecuteSaga } =
    await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return {
    getClient: () => testDb.drizzle,
    DrizzleAuditStore: RealAuditStore,
    executeSaga: realExecuteSaga,
  };
});

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn().mockResolvedValue('test-jwt-license-key'),
  resetLicenseState: vi.fn(),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ ai: true, payments: true })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/webhook-emails.js', () => ({
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
  sendCancellationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendDisputeReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendGracePeriodStartedEmail: vi.fn().mockResolvedValue(undefined),
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessedEmail: vi.fn().mockResolvedValue(undefined),
  sendSupportRenewalConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendTrialExpiredEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
  resetSupportExpiryCache: vi.fn(),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { licenses, processedWebhookEvents, users } from '@revealui/db/schema';
import webhooksRoute from '../webhooks.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'whsec_test_secret';

function makeStripeEvent(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, '')}`,
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  };
}

async function postWebhook(event: Record<string, unknown>): Promise<Response> {
  const body = JSON.stringify(event);
  mockConstructEvent.mockResolvedValueOnce(event);

  return webhooksRoute.request('/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 't=12345,v1=fake',
    },
    body,
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-private-key';

  testDb = await createTestDb();
}, 30_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: stripe.subscriptions.retrieve returns an active subscription
  mockSubscriptionsRetrieve.mockResolvedValue({
    id: 'sub_mock',
    status: 'active',
    trial_end: null,
    items: {
      data: [
        {
          id: 'si_mock',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
    },
    metadata: {},
  });
});

afterEach(async () => {
  // Clean test data in FK-safe order
  const { sql } = await import('drizzle-orm');
  await testDb.drizzle.execute(sql.raw('DELETE FROM "licenses"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "processed_webhook_events"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_subscriptions"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_memberships"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_entitlements"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "accounts"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "agent_credit_balance"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "users"'));
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('webhook integration  -  idempotency', () => {
  it('marks event as processed in DB', async () => {
    await seedTestUser(testDb.drizzle, {
      id: 'user-idem',
      email: 'idem@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_idem' })
      .where(eq(users.id, 'user-idem'));

    const event = makeStripeEvent('checkout.session.completed', {
      id: 'cs_test_idem',
      mode: 'subscription',
      customer: 'cus_idem',
      subscription: 'sub_idem',
      metadata: { tier: 'pro', revealui_user_id: 'user-idem' },
    });

    const res = await postWebhook(event);
    if (res.status !== 200) {
      const errBody = await res.clone().text();
      throw new Error(`Expected 200, got ${res.status}: ${errBody}`);
    }

    // Event should be marked as processed
    const rows = await testDb.drizzle
      .select()
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.id, event.id as string));
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('checkout.session.completed');
  });

  it('rejects duplicate events on second delivery', async () => {
    // Seed a user so the first call succeeds
    await seedTestUser(testDb.drizzle, {
      id: 'user-dup',
      email: 'dup@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_dup' })
      .where(eq(users.id, 'user-dup'));

    const event = makeStripeEvent('checkout.session.completed', {
      id: 'cs_test_dup',
      mode: 'subscription',
      customer: 'cus_dup',
      subscription: 'sub_dup',
      metadata: { tier: 'pro', revealui_user_id: 'user-dup' },
    });

    // First delivery  -  should succeed
    const res1 = await postWebhook(event);
    expect(res1.status).toBe(200);

    // Second delivery (same event ID)  -  should be detected as duplicate
    const res2 = await postWebhook(event);
    expect(res2.status).toBe(200);

    const body = await res2.json();
    expect(body.duplicate).toBe(true);
  });
});

describe('webhook integration  -  checkout.session.completed (subscription)', () => {
  it('creates license on subscription checkout', async () => {
    await seedTestUser(testDb.drizzle, {
      id: 'user-sub-1',
      email: 'subscriber@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_sub_1' })
      .where(eq(users.id, 'user-sub-1'));

    const event = makeStripeEvent('checkout.session.completed', {
      id: 'cs_test_sub_1',
      mode: 'subscription',
      customer: 'cus_sub_1',
      subscription: 'sub_checkout_1',
      customer_email: 'subscriber@example.com',
      metadata: { tier: 'pro', revealui_user_id: 'user-sub-1' },
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    // Verify license was created
    const licenseRows = await testDb.drizzle
      .select()
      .from(licenses)
      .where(eq(licenses.customerId, 'cus_sub_1'));

    expect(licenseRows).toHaveLength(1);
    expect(licenseRows[0].tier).toBe('pro');
    expect(licenseRows[0].status).toBe('active');
    expect(licenseRows[0].subscriptionId).toBe('sub_checkout_1');
    expect(licenseRows[0].perpetual).toBe(false);
    expect(licenseRows[0].licenseKey).toBe('test-jwt-license-key');
  });
});

describe('webhook integration  -  checkout.session.completed (perpetual)', () => {
  it('creates perpetual license on one-time payment', async () => {
    await seedTestUser(testDb.drizzle, {
      id: 'user-perp-1',
      email: 'perpetual@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_perp_1' })
      .where(eq(users.id, 'user-perp-1'));

    const event = makeStripeEvent('checkout.session.completed', {
      id: 'cs_test_perp_1',
      mode: 'payment',
      customer: 'cus_perp_1',
      customer_email: 'perpetual@example.com',
      metadata: { tier: 'max', revealui_user_id: 'user-perp-1' },
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    const licenseRows = await testDb.drizzle
      .select()
      .from(licenses)
      .where(eq(licenses.customerId, 'cus_perp_1'));

    expect(licenseRows).toHaveLength(1);
    expect(licenseRows[0].tier).toBe('max');
    expect(licenseRows[0].perpetual).toBe(true);
    expect(licenseRows[0].subscriptionId).toBeNull();
    expect(licenseRows[0].expiresAt).toBeNull();
    expect(licenseRows[0].supportExpiresAt).toBeInstanceOf(Date);
  });
});

describe('webhook integration  -  customer.subscription.deleted', () => {
  it('revokes license when subscription is cancelled', async () => {
    // Seed user + license
    await seedTestUser(testDb.drizzle, {
      id: 'user-del-1',
      email: 'cancelled@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_del_1' })
      .where(eq(users.id, 'user-del-1'));

    await testDb.drizzle.insert(licenses).values({
      id: 'lic-del-1',
      userId: 'user-del-1',
      licenseKey: 'active-key',
      tier: 'pro',
      customerId: 'cus_del_1',
      subscriptionId: 'sub_del_1',
      status: 'active',
    });

    const event = makeStripeEvent('customer.subscription.deleted', {
      id: 'sub_del_1',
      customer: 'cus_del_1',
      status: 'canceled',
      metadata: { tier: 'pro' },
      items: { data: [] },
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    // License should be revoked
    const licenseRows = await testDb.drizzle
      .select()
      .from(licenses)
      .where(eq(licenses.id, 'lic-del-1'));

    expect(licenseRows).toHaveLength(1);
    expect(licenseRows[0].status).toBe('revoked');
  });
});

describe('webhook integration  -  customer.deleted (GAP-140 perpetual protection)', () => {
  it('revokes ONLY non-perpetual licenses; perpetual licenses are preserved', async () => {
    // Setup: one user with BOTH a subscription license AND a perpetual license
    // for the same Stripe customer. The perpetual license represents a
    // separately-purchased one-time purchase that must NOT be revoked when
    // the Stripe customer record is deleted.
    await seedTestUser(testDb.drizzle, {
      id: 'user-mixed-1',
      email: 'mixed@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_mixed_1' })
      .where(eq(users.id, 'user-mixed-1'));

    // Subscription license (must be revoked on customer.deleted)
    await testDb.drizzle.insert(licenses).values({
      id: 'lic-sub-1',
      userId: 'user-mixed-1',
      licenseKey: 'sub-key',
      tier: 'pro',
      customerId: 'cus_mixed_1',
      subscriptionId: 'sub_mixed_1',
      status: 'active',
      perpetual: false,
    });

    // Perpetual license (must be preserved on customer.deleted)
    await testDb.drizzle.insert(licenses).values({
      id: 'lic-perp-1',
      userId: 'user-mixed-1',
      licenseKey: 'perp-key',
      tier: 'pro',
      customerId: 'cus_mixed_1',
      subscriptionId: null,
      status: 'active',
      perpetual: true,
    });

    const event = makeStripeEvent('customer.deleted', {
      id: 'cus_mixed_1',
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    // Subscription license should be revoked
    const subRow = await testDb.drizzle.select().from(licenses).where(eq(licenses.id, 'lic-sub-1'));
    expect(subRow).toHaveLength(1);
    expect(subRow[0].status).toBe('revoked');

    // Perpetual license should be PRESERVED (status still 'active')
    const perpRow = await testDb.drizzle
      .select()
      .from(licenses)
      .where(eq(licenses.id, 'lic-perp-1'));
    expect(perpRow).toHaveLength(1);
    expect(perpRow[0].status).toBe('active');
    expect(perpRow[0].perpetual).toBe(true);
  });

  it('revokes only-subscription license set when no perpetual licenses exist', async () => {
    // Regression check: customer with no perpetual still has all subscription
    // licenses revoked correctly.
    await seedTestUser(testDb.drizzle, {
      id: 'user-sub-only',
      email: 'subonly@example.com',
    });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_sub_only' })
      .where(eq(users.id, 'user-sub-only'));

    await testDb.drizzle.insert(licenses).values({
      id: 'lic-sub-only-1',
      userId: 'user-sub-only',
      licenseKey: 'sub-only-key',
      tier: 'pro',
      customerId: 'cus_sub_only',
      subscriptionId: 'sub_only_1',
      status: 'active',
      perpetual: false,
    });

    const event = makeStripeEvent('customer.deleted', {
      id: 'cus_sub_only',
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    const rows = await testDb.drizzle
      .select()
      .from(licenses)
      .where(eq(licenses.id, 'lic-sub-only-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('revoked');
  });
});

describe('webhook integration  -  irrelevant events', () => {
  it('returns 200 without processing for unknown event types', async () => {
    const event = makeStripeEvent('invoice.created', {
      id: 'inv_test_1',
    });

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    // Should NOT be recorded in processed_webhook_events
    const rows = await testDb.drizzle
      .select()
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.id, event.id as string));
    expect(rows).toHaveLength(0);
  });
});
