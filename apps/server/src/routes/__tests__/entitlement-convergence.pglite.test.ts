/**
 * GAP-356 — Hosted entitlement convergence (PR-1).
 *
 * PGlite (in-memory Postgres) + real Drizzle + the real webhook handler,
 * driven through the Hono route exactly as production Stripe deliveries hit it.
 * The REAL migrations are applied by `createTestDb`, so the `account_entitlements`
 * CHECK constraint and the `last_event_at` columns are the production ones.
 *
 * Proves the four-defect convergence fix:
 *   D1 — a trialing subscription.created no longer throws on the entitlement
 *        CHECK constraint (F1 widens it to allow 'trialing').
 *   D2 — the per-table event-to-event staleness guard no longer early-returns
 *        the whole function, so checkout.session.completed always reaches the
 *        entitlement upsert (F2). Reproduced with PAST event timestamps so the
 *        old wall-clock `updated_at < event.created` guard judges the second
 *        event stale (exactly the production burst condition).
 *
 * Stripe signature verification, license-key signing, and emails are mocked;
 * every DB write, the idempotency state machine, and the saga run for real.
 */

import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedTestUser,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const { mockConstructEvent, mockSubscriptionsRetrieve } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: vi.fn(),
        retrieve: mockSubscriptionsRetrieve,
        cancel: vi.fn(),
        list: vi.fn().mockResolvedValue({ data: [] }),
      };
      customers = { update: vi.fn() };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: {
      update: vi.fn(),
      retrieve: mockSubscriptionsRetrieve,
      cancel: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    customers: { update: vi.fn() },
  },
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
  normalizePem: (raw: string) => raw.split('\\n').join('\n'),
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  generateLicenseKey: vi.fn().mockResolvedValue('test-jwt-license-key'),
  resetLicenseState: vi.fn(),
  subscriptionLicenseExpiresInSeconds: vi.fn(() => 3600),
  subscriptionExpBound: vi.fn(() => 9_999_999_999),
  readLicenseExp: vi.fn(async () => null),
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
  sendPaymentActionRequiredEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseRevokedEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundProcessedEmail: vi.fn().mockResolvedValue(undefined),
  sendSupportRenewalConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendTrialExpiredEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  sendLivemodeMismatchAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/license.js', () => ({
  resetDbStatusCache: vi.fn(),
  resetSupportExpiryCache: vi.fn(),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  users,
} from '@revealui/db/schema';
import webhooksRoute from '../webhooks.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'whsec_test_secret';

/** Build a Stripe event with an explicit `created` (seconds). PAST timestamps
 *  are deliberate: they make the row's wall-clock `updated_at` (set at
 *  processing time = now) LATER than `event.created`, which is what the old
 *  cross-clock guard mis-read as "stale". */
function makeEvent(
  type: string,
  createdSec: number,
  object: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, '')}`,
    type,
    data: { object },
    created: createdSec,
    livemode: false,
  };
}

async function postWebhook(event: Record<string, unknown>): Promise<Response> {
  mockConstructEvent.mockResolvedValueOnce(event);
  return webhooksRoute.request('/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 't=12345,v1=fake',
    },
    body: JSON.stringify(event),
  });
}

function subscriptionObject(
  id: string,
  customer: string,
  status: string,
  createdSec: number,
  tier: string,
): Record<string, unknown> {
  return {
    id,
    customer,
    status,
    trial_end: status === 'trialing' ? createdSec + 7 * 24 * 60 * 60 : null,
    items: {
      data: [
        {
          id: `si_${id}`,
          current_period_start: createdSec,
          current_period_end: createdSec + 30 * 24 * 60 * 60,
        },
      ],
    },
    metadata: { tier },
  };
}

/** Configure the retrieve mock the checkout saga uses to read the subscription. */
function stubRetrieve(id: string, status: string, createdSec: number, tier: string): void {
  mockSubscriptionsRetrieve.mockResolvedValue(
    subscriptionObject(id, `cus_${id}`, status, createdSec, tier),
  );
}

async function accountIdForCustomer(customerId: string): Promise<string | undefined> {
  const [row] = await testDb.drizzle
    .select({ accountId: accountSubscriptions.accountId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.accountId;
}

async function entitlementForCustomer(
  customerId: string,
): Promise<{ tier: string; status: string } | undefined> {
  const accountId = await accountIdForCustomer(customerId);
  if (!accountId) return undefined;
  const [row] = await testDb.drizzle
    .select({ tier: accountEntitlements.tier, status: accountEntitlements.status })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);
  return row;
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  const { sql } = await import('drizzle-orm');
  await testDb.drizzle.execute(sql.raw('DELETE FROM "licenses"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "processed_webhook_events"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "unreconciled_webhooks"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_entitlements"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_subscriptions"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_memberships"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "accounts"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "users"'));
});

// A window of event.created values, all safely in the past.
const BASE = Math.floor(Date.now() / 1000) - 3600;

// ─── Test 1 — trialing checkout converges ────────────────────────────────────

describe('GAP-356 — trialing subscription.created then checkout converges to pro', () => {
  it('writes a trialing entitlement on created (F1) and converges to pro/active on checkout (F2)', async () => {
    await seedTestUser(testDb.drizzle, { id: 'u1', email: 'u1@example.com' });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_conv1' })
      .where(eq(users.id, 'u1'));

    // customer.subscription.created — trialing, tier pro, older event.
    const created = makeEvent(
      'customer.subscription.created',
      BASE,
      subscriptionObject('sub_conv1', 'cus_conv1', 'trialing', BASE, 'pro'),
    );
    const r1 = await postWebhook(created);
    // F1: on the ORIGINAL constraint this INSERT threw a check violation → 500.
    expect(r1.status).toBe(200);

    // F1 direct: the trialing entitlement row exists at this point.
    const afterCreated = await entitlementForCustomer('cus_conv1');
    expect(afterCreated).toBeDefined();
    expect(afterCreated?.tier).toBe('pro');
    expect(afterCreated?.status).toBe('trialing');

    // checkout.session.completed — active, tier pro, NEWER event.
    stubRetrieve('conv1', 'active', BASE + 100, 'pro');
    const checkout = makeEvent('checkout.session.completed', BASE + 100, {
      id: 'cs_conv1',
      mode: 'subscription',
      customer: 'cus_conv1',
      subscription: 'sub_conv1',
      customer_email: 'u1@example.com',
      metadata: { tier: 'pro', revealui_user_id: 'u1' },
    });
    const r2 = await postWebhook(checkout);
    expect(r2.status).toBe(200);

    // Terminal: the entitlement the customer paid for exists and is healthy.
    const terminal = await entitlementForCustomer('cus_conv1');
    expect(terminal).toBeDefined();
    expect(terminal?.tier).toBe('pro');
    expect(terminal?.status).toBe('active'); // healthy
  });
});

// ─── Test 2 — event-order permutations + redelivery ──────────────────────────

describe('GAP-356 — all event orders and redeliveries converge', () => {
  it('created-first and checkout-first both converge to pro/active, redelivery is a no-op', async () => {
    const T1 = BASE; // subscription.created (trialing)
    const T2 = BASE + 100; // checkout.session.completed (active) — always newer

    // ── Permutation A: created(T1) then checkout(T2) ──────────────────────
    await seedTestUser(testDb.drizzle, { id: 'uA', email: 'ua@example.com' });
    await testDb.drizzle.update(users).set({ stripeCustomerId: 'cus_A' }).where(eq(users.id, 'uA'));

    const createdA = makeEvent(
      'customer.subscription.created',
      T1,
      subscriptionObject('sub_A', 'cus_A', 'trialing', T1, 'pro'),
    );
    expect((await postWebhook(createdA)).status).toBe(200);

    stubRetrieve('A', 'active', T2, 'pro');
    const checkoutA = makeEvent('checkout.session.completed', T2, {
      id: 'cs_A',
      mode: 'subscription',
      customer: 'cus_A',
      subscription: 'sub_A',
      customer_email: 'ua@example.com',
      metadata: { tier: 'pro', revealui_user_id: 'uA' },
    });
    expect((await postWebhook(checkoutA)).status).toBe(200);

    let entA = await entitlementForCustomer('cus_A');
    expect(entA).toEqual({ tier: 'pro', status: 'active' });

    // Redelivery of the checkout event — idempotency short-circuits, state holds.
    const redeliverA = await postWebhook(checkoutA);
    expect(redeliverA.status).toBe(200);
    expect((await redeliverA.json()).duplicate).toBe(true);
    entA = await entitlementForCustomer('cus_A');
    expect(entA).toEqual({ tier: 'pro', status: 'active' });

    // ── Permutation B: checkout(T2) then created(T1) — out of order ────────
    await seedTestUser(testDb.drizzle, { id: 'uB', email: 'ub@example.com' });
    await testDb.drizzle.update(users).set({ stripeCustomerId: 'cus_B' }).where(eq(users.id, 'uB'));

    stubRetrieve('B', 'active', T2, 'pro');
    const checkoutB = makeEvent('checkout.session.completed', T2, {
      id: 'cs_B',
      mode: 'subscription',
      customer: 'cus_B',
      subscription: 'sub_B',
      customer_email: 'ub@example.com',
      metadata: { tier: 'pro', revealui_user_id: 'uB' },
    });
    expect((await postWebhook(checkoutB)).status).toBe(200);

    // The stale created event must NOT resurrect trialing over the newer active.
    const createdB = makeEvent(
      'customer.subscription.created',
      T1,
      subscriptionObject('sub_B', 'cus_B', 'trialing', T1, 'pro'),
    );
    expect((await postWebhook(createdB)).status).toBe(200);

    let entB = await entitlementForCustomer('cus_B');
    expect(entB).toEqual({ tier: 'pro', status: 'active' });

    // Redelivery of the created event — no-op.
    const redeliverB = await postWebhook(createdB);
    expect(redeliverB.status).toBe(200);
    expect((await redeliverB.json()).duplicate).toBe(true);
    entB = await entitlementForCustomer('cus_B');
    expect(entB).toEqual({ tier: 'pro', status: 'active' });

    // Both orders reached the same terminal entitlement.
    expect(entA).toEqual(entB);
  });
});

// ─── Test 3 — per-row event-to-event guard semantics ─────────────────────────

describe('GAP-356 — staleness guard is per-row and event-to-event', () => {
  it('older event skipped per-row; newer applies even when sibling skipped; NULL applies', async () => {
    const tsPast = new Date(BASE * 1000);
    const tsFuture = new Date((BASE + 1000) * 1000);
    const tMid = BASE + 500;

    // Seed an account whose SUBSCRIPTION was last touched by a FUTURE event and
    // whose ENTITLEMENT was last touched by a PAST event — asymmetric clocks.
    await testDb.drizzle.insert(accounts).values({
      id: 'acct_g',
      name: 'Guard Workspace',
      slug: 'acct-guard',
      status: 'active',
    });
    await seedTestUser(testDb.drizzle, { id: 'u_g', email: 'ug@example.com' });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_g' })
      .where(eq(users.id, 'u_g'));
    await testDb.drizzle.insert(accountMemberships).values({
      id: 'mem_g',
      accountId: 'acct_g',
      userId: 'u_g',
      role: 'owner',
      status: 'active',
    });
    await testDb.drizzle.insert(accountSubscriptions).values({
      id: 'sub_g',
      accountId: 'acct_g',
      stripeCustomerId: 'cus_g',
      stripeSubscriptionId: 'sub_g',
      planId: 'pro',
      status: 'trialing',
      mode: 'test',
      lastEventAt: tsFuture,
    });
    await testDb.drizzle.insert(accountEntitlements).values({
      accountId: 'acct_g',
      planId: 'pro',
      tier: 'pro',
      status: 'trialing',
      mode: 'test',
      lastEventAt: tsPast,
    });

    // ONE event at tMid: older than the subscription's clock, newer than the
    // entitlement's. It carries a different tier/status (max/active).
    const guardEvent = makeEvent(
      'customer.subscription.created',
      tMid,
      subscriptionObject('sub_g', 'cus_g', 'active', tMid, 'max'),
    );
    expect((await postWebhook(guardEvent)).status).toBe(200);

    // Subscription: event OLDER than last_event_at → skipped for this row only.
    const [sub] = await testDb.drizzle
      .select({ planId: accountSubscriptions.planId, status: accountSubscriptions.status })
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.stripeCustomerId, 'cus_g'))
      .limit(1);
    expect(sub).toEqual({ planId: 'pro', status: 'trialing' });

    // Entitlement: event NEWER than last_event_at → applied, EVEN THOUGH the
    // sibling subscription write was skipped (the D2 independence guarantee).
    const [ent] = await testDb.drizzle
      .select({ tier: accountEntitlements.tier, status: accountEntitlements.status })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, 'acct_g'))
      .limit(1);
    expect(ent).toEqual({ tier: 'max', status: 'active' });

    // NULL last_event_at (fresh account) always applies.
    await seedTestUser(testDb.drizzle, { id: 'u_g2', email: 'ug2@example.com' });
    await testDb.drizzle
      .update(users)
      .set({ stripeCustomerId: 'cus_g2' })
      .where(eq(users.id, 'u_g2'));
    const freshEvent = makeEvent(
      'customer.subscription.created',
      BASE + 200,
      subscriptionObject('sub_g2', 'cus_g2', 'trialing', BASE + 200, 'pro'),
    );
    expect((await postWebhook(freshEvent)).status).toBe(200);
    const fresh = await entitlementForCustomer('cus_g2');
    expect(fresh).toEqual({ tier: 'pro', status: 'trialing' });
  });
});
