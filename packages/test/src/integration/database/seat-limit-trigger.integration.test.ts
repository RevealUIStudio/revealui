/**
 * Integration tests for the account_memberships seat-limit trigger
 * (CR8-P2-03 defense-in-depth).
 *
 * Migration: packages/db/migrations/0007_account_membership_seat_limit.sql
 * App-level guard: apps/server/src/lib/seat-count-guard.ts (unit-tested separately).
 *
 * This file exercises the DB-level enforcement — the trigger fires on direct
 * SQL inserts that bypass the app guard, which is the whole point of
 * defense-in-depth. Covers:
 *   1. Enforcement when an entitlement limit exists
 *   2. No-op when entitlement row is absent (unlimited / enterprise)
 *   3. No-op when limits.maxUsers is absent (enterprise shape)
 *   4. Only active memberships count (invited / revoked don't consume seats)
 *   5. UPDATE OF status to 'active' also triggers the check
 *   6. PostgreSQL error code is check_violation so callers can classify
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('account_memberships seat-limit trigger (CR8-P2-03)', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean between tests. Order matters: memberships before entitlements
    // before accounts; users after memberships (FK cascade paths).
    await db.pglite.exec('DELETE FROM account_memberships');
    await db.pglite.exec('DELETE FROM account_entitlements');
    await db.pglite.exec('DELETE FROM accounts');
    await db.pglite.exec('DELETE FROM users');
  });

  async function createAccount(id: string) {
    await db.pglite.exec(
      `INSERT INTO accounts (id, name, slug) VALUES ('${id}', '${id}', '${id}')`,
    );
  }

  async function createEntitlement(
    accountId: string,
    tier: string,
    limits: { maxUsers?: number } | null,
  ) {
    const limitsJson = limits === null ? '{}' : JSON.stringify(limits);
    await db.pglite.query(
      `INSERT INTO account_entitlements (account_id, plan_id, tier, limits)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [accountId, `${tier}-plan`, tier, limitsJson],
    );
  }

  async function createUser(id: string) {
    await db.pglite.query(
      `INSERT INTO users (id, email, password, name)
       VALUES ($1, $2, 'x', $3)`,
      [id, `${id}@test.com`, id],
    );
  }

  async function createMembership(
    id: string,
    accountId: string,
    userId: string,
    status: 'active' | 'invited' | 'revoked' = 'active',
  ) {
    await db.pglite.query(
      `INSERT INTO account_memberships (id, account_id, user_id, status)
       VALUES ($1, $2, $3, $4)`,
      [id, accountId, userId, status],
    );
  }

  it('allows inserts when under the cap', async () => {
    await createAccount('acct-pro');
    await createEntitlement('acct-pro', 'pro', { maxUsers: 3 });
    for (let i = 0; i < 3; i++) {
      await createUser(`u-${i}`);
    }
    await createMembership('m-1', 'acct-pro', 'u-0');
    await createMembership('m-2', 'acct-pro', 'u-1');
    await createMembership('m-3', 'acct-pro', 'u-2');

    const result = await db.pglite.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM account_memberships WHERE account_id = 'acct-pro'`,
    );
    expect(result.rows[0]?.count).toBe('3');
  });

  it('blocks direct INSERT that would exceed the cap', async () => {
    await createAccount('acct-pro-full');
    await createEntitlement('acct-pro-full', 'pro', { maxUsers: 2 });
    for (let i = 0; i < 3; i++) {
      await createUser(`v-${i}`);
    }
    await createMembership('mm-1', 'acct-pro-full', 'v-0');
    await createMembership('mm-2', 'acct-pro-full', 'v-1');

    // Third insert should fail with check_violation via trigger RAISE EXCEPTION.
    await expect(createMembership('mm-3', 'acct-pro-full', 'v-2')).rejects.toThrow(
      /seat_limit_reached/,
    );

    // Confirm only two rows persisted.
    const result = await db.pglite.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM account_memberships WHERE account_id = 'acct-pro-full'`,
    );
    expect(result.rows[0]?.count).toBe('2');
  });

  it('no-ops when entitlement row is missing (unlimited default)', async () => {
    await createAccount('acct-no-ent');
    // No entitlement row inserted at all.
    for (let i = 0; i < 5; i++) {
      await createUser(`w-${i}`);
    }
    for (let i = 0; i < 5; i++) {
      await createMembership(`nm-${i}`, 'acct-no-ent', `w-${i}`);
    }
    const result = await db.pglite.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM account_memberships WHERE account_id = 'acct-no-ent'`,
    );
    expect(result.rows[0]?.count).toBe('5');
  });

  it('no-ops when limits.maxUsers is absent (enterprise shape)', async () => {
    await createAccount('acct-enterprise');
    await createEntitlement('acct-enterprise', 'enterprise', {});
    for (let i = 0; i < 10; i++) {
      await createUser(`x-${i}`);
    }
    for (let i = 0; i < 10; i++) {
      await createMembership(`em-${i}`, 'acct-enterprise', `x-${i}`);
    }
    const result = await db.pglite.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM account_memberships WHERE account_id = 'acct-enterprise'`,
    );
    expect(result.rows[0]?.count).toBe('10');
  });

  it('only active memberships count toward the cap', async () => {
    await createAccount('acct-mixed');
    await createEntitlement('acct-mixed', 'pro', { maxUsers: 2 });
    for (let i = 0; i < 5; i++) {
      await createUser(`y-${i}`);
    }
    // Two active + two invited + one revoked.
    await createMembership('am-1', 'acct-mixed', 'y-0', 'active');
    await createMembership('am-2', 'acct-mixed', 'y-1', 'active');
    await createMembership('am-3', 'acct-mixed', 'y-2', 'invited');
    await createMembership('am-4', 'acct-mixed', 'y-3', 'invited');
    await createMembership('am-5', 'acct-mixed', 'y-4', 'revoked');

    // Adding another active should fail.
    await createUser('y-5');
    await expect(createMembership('am-6', 'acct-mixed', 'y-5', 'active')).rejects.toThrow(
      /seat_limit_reached/,
    );

    // But another invited is fine.
    await createUser('y-6');
    await createMembership('am-7', 'acct-mixed', 'y-6', 'invited');
  });

  it('UPDATE of status to active triggers the check', async () => {
    await createAccount('acct-promote');
    await createEntitlement('acct-promote', 'pro', { maxUsers: 2 });
    for (let i = 0; i < 3; i++) {
      await createUser(`z-${i}`);
    }
    // Two active + one invited (promotable).
    await createMembership('pm-1', 'acct-promote', 'z-0', 'active');
    await createMembership('pm-2', 'acct-promote', 'z-1', 'active');
    await createMembership('pm-3', 'acct-promote', 'z-2', 'invited');

    // Promoting the invited row would bring active count from 2 → 3 (> 2).
    await expect(
      db.pglite.query(`UPDATE account_memberships SET status = 'active' WHERE id = 'pm-3'`),
    ).rejects.toThrow(/seat_limit_reached/);
  });

  it('uses check_violation error code so callers can classify', async () => {
    await createAccount('acct-err');
    await createEntitlement('acct-err', 'pro', { maxUsers: 1 });
    await createUser('err-0');
    await createUser('err-1');
    await createMembership('err-m-1', 'acct-err', 'err-0');

    try {
      await createMembership('err-m-2', 'acct-err', 'err-1');
      expect.fail('should have thrown');
    } catch (err) {
      const code = (err as { code?: string }).code;
      expect(code).toBe('23514'); // PostgreSQL check_violation
    }
  });
});
