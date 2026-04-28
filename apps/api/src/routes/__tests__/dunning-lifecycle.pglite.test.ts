/**
 * Dunning Lifecycle E2E (PGlite)
 *
 * Proves the `past_due → grace → expired` dunning flow end-to-end against a
 * real in-memory Postgres. The architecture of the flow is sound on paper:
 *
 *   1. `invoice.payment_failed` sets `accountEntitlements.status = 'past_due'`
 *      with `graceUntil = invoice.period_end`.
 *   2. `sweep-grace-periods` cron runs periodically. Once `graceUntil <= now`
 *      and the status is still `past_due`, the sweep transitions the row to
 *      `expired`.
 *   3. `checkLicenseStatus` middleware reads the entitlement and blocks
 *      requests when the subscription status is `expired` or `revoked`.
 *
 * The existing per-piece tests mock each boundary. This file seeds real rows
 * in a PGlite database, runs the actual cron handler, and verifies the
 * actual middleware's 403 response — so any regression in the chain (a
 * missing WHERE clause, a status-string typo, a middleware that forgets to
 * check `expired`) fails here.
 *
 * Customer-dollar impact: these transitions decide whether a customer whose
 * card failed keeps having access during the grace window and loses it
 * after. Broken either direction is a charge-readiness blocker.
 */

import { accountEntitlements, accountMemberships, accounts } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  seedTestUser,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const real = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return {
    ...real,
    getClient: () => testDb.drizzle,
  };
});

vi.mock('@revealui/db/client', async () => {
  const real = await vi.importActual<typeof import('@revealui/db/client')>('@revealui/db/client');
  return {
    ...real,
    getClient: () => testDb.drizzle,
    withTransaction: async (_db: unknown, fn: (tx: unknown) => unknown) => fn(testDb.drizzle),
  };
});

vi.mock('@revealui/core/license', () => ({
  resetLicenseState: vi.fn(),
  getCurrentTier: vi.fn(() => 'free'),
  getGraceConfig: vi.fn(() => ({ infraDays: 3 })),
  getLicensePayload: vi.fn(() => null),
  getLicenseStatus: vi.fn(() => ({ mode: 'active', graceRemainingMs: 0 })),
  isLicensed: vi.fn(() => false),
}));

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ ai: true, payments: true })),
  isFeatureEnabled: vi.fn(() => false),
  getRequiredTier: vi.fn(() => 'pro'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/x402.js', () => ({
  getX402Config: vi.fn(() => ({ enabled: false })),
  buildPaymentRequired: vi.fn(),
  encodePaymentRequired: vi.fn(() => ''),
  verifyPayment: vi.fn(async () => ({ valid: false })),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { entitlementMiddleware } from '../../middleware/entitlements.js';
import { checkLicenseStatus } from '../../middleware/license.js';
import sweepGracePeriodsApp from '../cron/sweep-grace-periods.js';

// ─── Setup ──────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-xxxxxxxxxxxxxxxx';

beforeAll(async () => {
  process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  testDb = await createTestDb();
}, 30_000);

afterAll(async () => {
  await testDb.close();
  delete process.env.REVEALUI_CRON_SECRET;
});

afterEach(async () => {
  const { sql } = await import('drizzle-orm');
  // FK-safe delete order (entitlements/memberships depend on accounts).
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_entitlements"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_memberships"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "account_subscriptions"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "accounts"'));
  await testDb.drizzle.execute(sql.raw('DELETE FROM "users"'));
});

// ─── Fixture helpers ────────────────────────────────────────────────────────

/**
 * Seed a user + account + membership + entitlement row so the full
 * entitlement-middleware resolution chain works.
 */
async function seedPaidUser(overrides: {
  userId?: string;
  accountId?: string;
  status?: 'active' | 'past_due' | 'expired' | 'revoked' | 'canceled';
  tier?: 'free' | 'pro' | 'max' | 'enterprise';
  graceUntil?: Date | null;
}): Promise<{ userId: string; accountId: string }> {
  const userId = overrides.userId ?? `user_${crypto.randomUUID()}`;
  const accountId = overrides.accountId ?? `acct_${crypto.randomUUID()}`;

  await seedTestUser(testDb.drizzle, { id: userId, email: `${userId}@example.com` });

  await testDb.drizzle.insert(accounts).values({
    id: accountId,
    name: 'Test Account',
    slug: `slug-${accountId}`,
  });

  await testDb.drizzle.insert(accountMemberships).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    role: 'owner',
    status: 'active',
  });

  await testDb.drizzle.insert(accountEntitlements).values({
    accountId,
    planId: overrides.tier ?? 'pro',
    tier: overrides.tier ?? 'pro',
    status: overrides.status ?? 'active',
    graceUntil: overrides.graceUntil ?? null,
    features: {},
    limits: {},
  });

  return { userId, accountId };
}

/**
 * Build a minimal protected-route app that runs the real
 * entitlementMiddleware + checkLicenseStatus chain and returns 200 when the
 * request passes, 403 when it is blocked. We stub the auth layer by
 * pre-setting `c.set('user')` from a header so the test can vary which
 * user the request is authenticated as.
 */
function protectedApp() {
  const app = new Hono<{
    Variables: { user: { id: string } | undefined; entitlements: unknown };
  }>();
  app.use('*', async (c, next) => {
    const userId = c.req.header('x-test-user-id');
    if (userId) c.set('user', { id: userId });
    await next();
  });
  app.use('*', entitlementMiddleware());
  app.use(
    '*',
    checkLicenseStatus(async () => null),
  );
  app.get('/protected', (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as { message?: string }).message ?? 'error';
    return c.json({ error: message }, status as 400 | 401 | 403 | 500);
  });
  return app;
}

function cronRequest(): Request {
  return new Request('http://localhost/sweep-grace-periods', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
}

// ─── Gate behavior ──────────────────────────────────────────────────────────

describe('dunning gate behavior (real DB, real middleware)', () => {
  it('allows requests when subscription is active', async () => {
    const { userId } = await seedPaidUser({ status: 'active' });
    const res = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(res.status).toBe(200);
  });

  // Note: `trialing` is not an accountEntitlements status value; the CHECK
  // constraint only allows ('active', 'past_due', 'canceled', 'expired',
  // 'revoked'). Trial subscriptions are mapped to entitlement.status='active'
  // by syncHostedSubscriptionState so the gate treats them like any other
  // active customer. No dedicated test needed — the active-status test above
  // covers the observable behavior.

  it('allows past_due requests during grace (graceUntil in the future)', async () => {
    const { userId } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const res = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(res.status).toBe(200);
  });

  it('blocks requests when subscription is expired', async () => {
    const { userId } = await seedPaidUser({ status: 'expired' });
    const res = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/expired/i);
  });

  it('blocks requests when subscription is revoked', async () => {
    const { userId } = await seedPaidUser({ status: 'revoked' });
    const res = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/revoked/i);
  });
});

// ─── Sweep cron transitions ─────────────────────────────────────────────────

describe('sweep-grace-periods against real DB', () => {
  it('transitions past_due → expired once graceUntil has passed', async () => {
    const { accountId } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() - 60 * 60 * 1000), // grace ended an hour ago
    });

    const res = await sweepGracePeriodsApp.fetch(cronRequest());
    expect(res.status).toBe(200);

    const [row] = await testDb.drizzle
      .select({ status: accountEntitlements.status, graceUntil: accountEntitlements.graceUntil })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, accountId));

    expect(row?.status).toBe('expired');
    expect(row?.graceUntil).toBeNull(); // sweep clears graceUntil on transition
  });

  it('does NOT transition past_due when graceUntil is still in the future', async () => {
    const graceUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { accountId } = await seedPaidUser({ status: 'past_due', graceUntil });

    const res = await sweepGracePeriodsApp.fetch(cronRequest());
    expect(res.status).toBe(200);

    const [row] = await testDb.drizzle
      .select({ status: accountEntitlements.status, graceUntil: accountEntitlements.graceUntil })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, accountId));

    expect(row?.status).toBe('past_due');
    expect(row?.graceUntil?.getTime()).toBe(graceUntil.getTime());
  });

  it('is a no-op for already-active rows', async () => {
    const { accountId } = await seedPaidUser({ status: 'active' });
    await sweepGracePeriodsApp.fetch(cronRequest());

    const [row] = await testDb.drizzle
      .select({ status: accountEntitlements.status })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, accountId));

    expect(row?.status).toBe('active');
  });

  it('handles a mixed batch: expires eligible rows, leaves others', async () => {
    const { accountId: acctEligible } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() - 1000),
    });
    const { accountId: acctNotYet } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const { accountId: acctActive } = await seedPaidUser({ status: 'active' });

    const res = await sweepGracePeriodsApp.fetch(cronRequest());
    expect(res.status).toBe(200);

    const rows = await testDb.drizzle
      .select({ accountId: accountEntitlements.accountId, status: accountEntitlements.status })
      .from(accountEntitlements);

    const byAccount = new Map(rows.map((r) => [r.accountId, r.status]));
    expect(byAccount.get(acctEligible)).toBe('expired');
    expect(byAccount.get(acctNotYet)).toBe('past_due');
    expect(byAccount.get(acctActive)).toBe('active');
  });
});

// ─── Full lifecycle: seed → sweep → gate ────────────────────────────────────

describe('dunning lifecycle end-to-end', () => {
  it('past_due with expired grace → sweep → gate blocks access', async () => {
    // 1. Customer is in past_due with grace that just expired.
    const { userId, accountId } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() - 1000),
    });

    // 2. Before the sweep runs, they still have access — grace has not
    //    yet been swept even though it ended. This is the expected
    //    behavior (sweep runs daily on Hobby; tighten via external
    //    scheduler if needed).
    const preSweep = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(preSweep.status).toBe(200);

    // 3. The cron runs and transitions the row.
    const sweep = await sweepGracePeriodsApp.fetch(cronRequest());
    expect(sweep.status).toBe(200);

    const [row] = await testDb.drizzle
      .select({ status: accountEntitlements.status })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, accountId));
    expect(row?.status).toBe('expired');

    // 4. Now the gate blocks.
    const postSweep = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(postSweep.status).toBe(403);
  });

  it('grace-still-valid → sweep noop → gate still allows', async () => {
    const { userId } = await seedPaidUser({
      status: 'past_due',
      graceUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const sweep = await sweepGracePeriodsApp.fetch(cronRequest());
    expect(sweep.status).toBe(200);

    const gate = await protectedApp().request('/protected', {
      headers: { 'x-test-user-id': userId },
    });
    expect(gate.status).toBe(200);
  });
});
