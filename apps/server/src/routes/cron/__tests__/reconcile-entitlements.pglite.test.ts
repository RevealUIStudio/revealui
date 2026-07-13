/**
 * GAP-356 F5 test 4 — the entitlement-consistency reconciler.
 *
 * PGlite + REAL migrations + the real Hono route. The defects this cron guards
 * live in cross-table state, so a DB-mocked unit test cannot see them.
 *
 * Covers the hardening from the PR-2 adversarial review:
 *   B1  a STALE subscription (period ended) is never healed from
 *   B3  a resolved drift alert does NOT suppress the next genuine drift
 *   B4  a RESUBSCRIBED customer over a terminal entitlement IS healed
 *   S1  mode scoping — a test-mode row never touches a live entitlement
 *   S2  `last_event_at` is preserved on UPDATE, nulled only on INSERT
 *   S4  the previously-untested rails: unresolvable tier, heal disabled, and
 *       the healed row's features/limits
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

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: () => 'live',
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn((tier: string) =>
    tier === 'pro' ? { ai: true, payments: true } : { ai: false, payments: false },
  ),
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
import { getHostedLimitsForTier } from '../../../lib/tier-limits.js';
import reconcileEntitlementsRoute from '../reconcile-entitlements.js';

const CRON_SECRET = 'test-cron-secret';
const HOUR = 60 * 60 * 1000;

async function runCron(): Promise<Record<string, unknown>> {
  const res = await reconcileEntitlementsRoute.request('/reconcile-entitlements', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  return (await res.json()) as Record<string, unknown>;
}

async function seedAccount(): Promise<{ accountId: string; userId: string }> {
  const { randomUUID } = await import('node:crypto');
  const user = await seedTestUser(testDb.drizzle);
  const accountId = randomUUID();
  await testDb.drizzle
    .insert(accounts)
    .values({ id: accountId, name: 'Acme', slug: `acme-${accountId.slice(0, 8)}` });
  await testDb.drizzle
    .insert(accountMemberships)
    .values({ id: randomUUID(), accountId, userId: user.id, role: 'owner', status: 'active' });
  return { accountId, userId: user.id };
}

async function seedSubscription(
  accountId: string,
  opts: { planId: string; status: string; periodEnd?: Date | null; mode?: 'live' | 'test' },
): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  await testDb.drizzle.insert(accountSubscriptions).values({
    id: randomUUID(),
    accountId,
    stripeCustomerId: `cus_${accountId.slice(0, 8)}`,
    stripeSubscriptionId: `sub_${accountId.slice(0, 8)}`,
    planId: opts.planId,
    status: opts.status,
    currentPeriodEnd: opts.periodEnd ?? new Date(Date.now() + 24 * HOUR),
    mode: opts.mode ?? 'live',
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
    mode: 'live',
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

async function getAlert(accountId: string) {
  const [row] = await testDb.drizzle
    .select()
    .from(unreconciledWebhooks)
    .where(eq(unreconciledWebhooks.eventId, `cron-entitlement-drift:${accountId}`))
    .limit(1);
  return row;
}

describe('cron: reconcile-entitlements (GAP-356 F4, hardened)', () => {
  beforeAll(async () => {
    testDb = await createTestDb();
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
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

  it('heals a missing entitlement from a fresh subscription, with the correct feature set', async () => {
    const { accountId, userId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'trialing' });
    await seedLicense(userId, 'pro');

    const body = await runCron();
    expect(body.healed).toBe(1);

    const ent = await getEntitlement(accountId);
    expect(ent?.tier).toBe('pro');
    expect(ent?.status).toBe('trialing');
    expect(ent?.meteringStatus).toBe('active');
    expect(ent?.mode).toBe('live');
    // INSERT: cursor NULL so the next webhook wins.
    expect(ent?.lastEventAt).toBeNull();
    // S4 — a heal must grant the SAME features/limits the webhook path would.
    expect(ent?.features).toEqual({ ai: true, payments: true });
    expect(ent?.limits).toEqual(getHostedLimitsForTier('pro'));
  });

  // ── B1: the over-grant the review found ──────────────────────────────────
  it('does NOT heal from a STALE subscription — an expired trial is not a licence to grant', async () => {
    const { accountId } = await seedAccount();
    // Still says `trialing` because the expiry webhook never landed — the exact
    // failure class this cron exists to backstop. The period ended a day ago.
    await seedSubscription(accountId, {
      planId: 'pro',
      status: 'trialing',
      periodEnd: new Date(Date.now() - 24 * HOUR),
    });

    const body = await runCron();
    expect(body.healed).toBe(0);
    expect(body.drift).toBe(1);

    // No free Pro, forever.
    expect(await getEntitlement(accountId)).toBeUndefined();
    expect((await getAlert(accountId))?.errorTrace).toContain('STALE');
  });

  it('does NOT heal when there is no entitlement source at all', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'canceled' });
    await testDb.drizzle
      .insert(accountEntitlements)
      .values({ accountId, planId: 'free', tier: 'free', status: 'active', mode: 'live' });

    const body = await runCron();
    expect(body.healed).toBe(0);
    expect(body.drift).toBe(0);
    expect((await getEntitlement(accountId))?.tier).toBe('free');
    expect(await getAlert(accountId)).toBeUndefined();
  });

  it('never downgrades: an existing higher tier survives a lower-tier subscription', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'trialing' });
    await testDb.drizzle
      .insert(accountEntitlements)
      .values({ accountId, planId: 'max', tier: 'max', status: 'active', mode: 'live' });

    const body = await runCron();
    expect(body.healed).toBe(0);
    expect((await getEntitlement(accountId))?.tier).toBe('max');
  });

  // ── B4: the rail the review found backwards ──────────────────────────────
  it('HEALS a resubscribed customer whose entitlement is terminal (the old rail denied this)', async () => {
    const { accountId } = await seedAccount();
    // They resubscribed — fresh, healthy Pro subscription…
    await seedSubscription(accountId, { planId: 'pro', status: 'active' });
    // …but the entitlement still sits expired from the previous cycle because its
    // write failed. The earlier terminal-status rail refused to heal exactly this
    // person, while letting a deleted row be resurrected.
    await testDb.drizzle
      .insert(accountEntitlements)
      .values({ accountId, planId: 'free', tier: 'free', status: 'expired', mode: 'live' });

    const body = await runCron();
    expect(body.healed).toBe(1);

    const ent = await getEntitlement(accountId);
    expect(ent?.tier).toBe('pro');
    expect(ent?.status).toBe('active');
  });

  // ── S2: the WH-3 window must stay closed ─────────────────────────────────
  it('preserves last_event_at on an UPDATE heal (nulling it would let a stale replay win)', async () => {
    const { accountId } = await seedAccount();
    const cursor = new Date(Date.now() - 10 * HOUR);
    await seedSubscription(accountId, { planId: 'max', status: 'active' });
    await testDb.drizzle.insert(accountEntitlements).values({
      accountId,
      planId: 'pro',
      tier: 'pro',
      status: 'active',
      mode: 'live',
      lastEventAt: cursor,
    });

    const body = await runCron();
    expect(body.healed).toBe(1);

    const ent = await getEntitlement(accountId);
    expect(ent?.tier).toBe('max');
    // Cursor survives the heal — a stale replayed event must still lose.
    expect(ent?.lastEventAt?.toISOString()).toBe(cursor.toISOString());
  });

  // ── S1: mode scoping ─────────────────────────────────────────────────────
  it('ignores a test-mode subscription when running in live mode', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'active', mode: 'test' });

    const body = await runCron();
    expect(body.healed).toBe(0);
    expect(body.drift).toBe(0);
    // A test-mode row must never mint a live entitlement.
    expect(await getEntitlement(accountId)).toBeUndefined();
  });

  // ── rails the review found untested ──────────────────────────────────────
  it('alerts without writing when the tier is unresolvable (never writes from ignorance)', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'mystery-plan', status: 'active' });

    const body = await runCron();
    expect(body.drift).toBe(1);
    expect(body.healed).toBe(0);
    expect(await getEntitlement(accountId)).toBeUndefined();
    expect((await getAlert(accountId))?.eventType).toBe('entitlement.drift');
  });

  it('alerts without healing when RECONCILE_ENTITLEMENTS_HEAL=false', async () => {
    process.env.RECONCILE_ENTITLEMENTS_HEAL = 'false';
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'active' });

    const body = await runCron();
    expect(body.healEnabled).toBe(false);
    expect(body.drift).toBe(1);
    expect(body.healed).toBe(0);
    expect(await getEntitlement(accountId)).toBeUndefined();
    expect(await getAlert(accountId)).toBeDefined();
  });

  // ── B3: the alert channel must not close itself ──────────────────────────
  it('re-alerts after a previous drift row was resolved (the drainer must not silence us)', async () => {
    const { accountId, userId } = await seedAccount();
    await seedLicense(userId, 'pro'); // license-only → alert, unhealable

    const first = await runCron();
    expect(first.alerted).toBe(1);

    // Simulate what `drain-unreconciled` did to our synthetic row: Stripe 404s,
    // so it stamped resolvedAt. (It now skips synthetic ids — but the reconciler
    // must be robust to a resolved row regardless, since an operator can resolve
    // one by hand.)
    await testDb.drizzle
      .update(unreconciledWebhooks)
      .set({ resolvedAt: new Date(), resolvedBy: 'cron:event-missing' })
      .where(eq(unreconciledWebhooks.eventId, `cron-entitlement-drift:${accountId}`));

    const second = await runCron();
    // The drift is still real, so it MUST be raised again.
    expect(second.drift).toBe(1);
    expect(second.alerted).toBe(1);
    expect((await getAlert(accountId))?.resolvedAt).toBeNull();
  });

  it('does not re-alert while the drift row is still open', async () => {
    const { userId } = await seedAccount();
    await seedLicense(userId, 'pro');

    const first = await runCron();
    expect(first.alerted).toBe(1);
    const second = await runCron();
    expect(second.drift).toBe(1);
    expect(second.alerted).toBe(0); // still open — no duplicate
  });

  it('closes its own alert once the drift is healed', async () => {
    const { accountId } = await seedAccount();
    await seedSubscription(accountId, { planId: 'pro', status: 'active' });

    const body = await runCron();
    expect(body.healed).toBe(1);

    const alert = await getAlert(accountId);
    expect(alert?.resolvedAt).not.toBeNull();
    expect(alert?.resolvedBy).toBe('cron:reconcile-entitlements');
  });
});
