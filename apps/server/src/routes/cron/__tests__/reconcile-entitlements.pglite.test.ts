/**
 * GAP-356 F5 test 4 — the entitlement-consistency reconciler (PR-2).
 *
 * PGlite (in-memory Postgres) + real Drizzle + the REAL migrations, driving the
 * actual cron route. The defect this cron exists to catch lives in cross-table
 * state, so a DB-mocked unit test cannot see it — the same reason the original
 * GAP-356 defect escaped every existing test.
 *
 * Proves:
 *   1. license=pro + subscription=trialing + entitlement MISSING  → healed to pro.
 *   2. entitlement=free + no healthy subscription and no license   → NO heal.
 *   3. heal is tier-monotonic UPWARD — an existing higher tier is never lowered.
 *   4. the drift alert row is idempotent across repeated cron runs.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedTestUser,
  type TestDb,
} from '../../../../../../packages/test/src/utils/drizzle-test-db.js';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

let testDb: TestDb;

vi.mock('@revealui/db', () => ({
  getClient: () => testDb.drizzle,
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ ai: true, payments: true })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../lib/cron-alerts.js', () => ({
  sendCronFailureAlert: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  licenses,
  unreconciledWebhooks,
} from '@revealui/db/schema';
import reconcileEntitlementsRoute from '../reconcile-entitlements.js';

const CRON_SECRET = 'test-cron-secret';

async function runCron(): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await reconcileEntitlementsRoute.request('/reconcile-entitlements', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Seed an account with one active member. Returns ids. */
async function seedAccount(): Promise<{ accountId: string; userId: string }> {
  const { randomUUID } = await import('node:crypto');
  const user = await seedTestUser(testDb.drizzle);
  const accountId = randomUUID();

  await testDb.drizzle.insert(accounts).values({
    id: accountId,
    name: 'Acme',
    slug: `acme-${accountId.slice(0, 8)}`,
    status: 'active',
  });
  await testDb.drizzle.insert(accountMemberships).values({
    id: randomUUID(),
    accountId,
    userId: user.id,
    role: 'owner',
    status: 'active',
  });

  return { accountId, userId: user.id };
}

async function seedSubscription(accountId: string, planId: string, status: string): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  await testDb.drizzle.insert(accountSubscriptions).values({
    id: randomUUID(),
    accountId,
    stripeCustomerId: `cus_${accountId.slice(0, 8)}`,
    stripeSubscriptionId: `sub_${accountId.slice(0, 8)}`,
    planId,
    status,
    mode: 'test',
  });
}

async function seedLicense(userId: string, tier: string): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  await testDb.drizzle.insert(licenses).values({
    id: randomUUID(),
    userId,
    licenseKey: `key-${randomUUID()}`,
    tier,
    customerId: `cus_${userId.slice(0, 8)}`,
    status: 'active',
  });
}

async function getEntitlement(accountId: string) {
  const [row] = await testDb.drizzle
    .select()
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);
  return row;
}

describe('cron: reconcile-entitlements (GAP-356 F4)', () => {
  beforeAll(async () => {
    testDb = await createTestDb();
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    // Order matters: children before parents (FKs).
    await testDb.drizzle.delete(unreconciledWebhooks);
    await testDb.drizzle.delete(accountEntitlements);
    await testDb.drizzle.delete(accountSubscriptions);
    await testDb.drizzle.delete(licenses);
    await testDb.drizzle.delete(accountMemberships);
    await testDb.drizzle.delete(accounts);
    process.env.RECONCILE_ENTITLEMENTS_HEAL = 'true';
  });

  it('rejects a request without the cron secret', async () => {
    const res = await reconcileEntitlementsRoute.request('/reconcile-entitlements', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('heals a missing entitlement from the local subscription row (license=pro, subscription=trialing)', async () => {
    const { accountId, userId } = await seedAccount();
    await seedSubscription(accountId, 'pro', 'trialing');
    await seedLicense(userId, 'pro');

    // Precondition: the exact production incident — paying/trialing, no entitlement.
    expect(await getEntitlement(accountId)).toBeUndefined();

    const { status, body } = await runCron();
    expect(status).toBe(200);
    expect(body.healed).toBe(1);

    const ent = await getEntitlement(accountId);
    expect(ent).toBeDefined();
    expect(ent?.tier).toBe('pro');
    expect(ent?.planId).toBe('pro');
    // Status is carried from the local subscription row — the trial signal survives.
    expect(ent?.status).toBe('trialing');
    expect(ent?.meteringStatus).toBe('active');
    // NULL by design: the next webhook must always win over a healed row.
    expect(ent?.lastEventAt).toBeNull();
  });

  it('does NOT heal when there is no entitlement source (entitlement=free, no healthy subscription, no license)', async () => {
    const { accountId } = await seedAccount();
    // Canceled subscription is not a healthy source.
    await seedSubscription(accountId, 'pro', 'canceled');
    await testDb.drizzle.insert(accountEntitlements).values({
      accountId,
      planId: 'free',
      tier: 'free',
      status: 'active',
    });

    const { body } = await runCron();
    expect(body.healed).toBe(0);
    expect(body.drift).toBe(0);

    const ent = await getEntitlement(accountId);
    expect(ent?.tier).toBe('free');

    // And it must not have invented a drift alert.
    const alerts = await testDb.drizzle.select().from(unreconciledWebhooks);
    expect(alerts).toHaveLength(0);
  });

  it('never downgrades: an existing higher tier survives a lower-tier subscription', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, 'pro', 'trialing');
    await testDb.drizzle.insert(accountEntitlements).values({
      accountId,
      planId: 'max',
      tier: 'max',
      status: 'active',
    });

    const { body } = await runCron();
    expect(body.healed).toBe(0);

    const ent = await getEntitlement(accountId);
    expect(ent?.tier).toBe('max');
    expect(ent?.status).toBe('active');
  });

  it('writes an idempotent drift alert — a standing drift does not re-alert every tick', async () => {
    // License-only drift: a real entitlement source, but no local subscription
    // row to safely synthesize from. Alerts, cannot heal — so the drift stands
    // across runs and the idempotency of the alert row is what is under test.
    const { accountId, userId } = await seedAccount();
    await seedLicense(userId, 'pro');

    const first = await runCron();
    expect(first.body.drift).toBe(1);
    expect(first.body.alerted).toBe(1);
    expect(first.body.healed).toBe(0);

    const second = await runCron();
    expect(second.body.drift).toBe(1);
    // Still drifting, but NOT re-alerted — the synthetic event_id collides.
    expect(second.body.alerted).toBe(0);

    const alerts = await testDb.drizzle
      .select()
      .from(unreconciledWebhooks)
      .where(eq(unreconciledWebhooks.eventId, `cron-entitlement-drift:${accountId}`));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.eventType).toBe('entitlement.drift');

    // No entitlement was synthesized from a license alone.
    expect(await getEntitlement(accountId)).toBeUndefined();
  });
});
