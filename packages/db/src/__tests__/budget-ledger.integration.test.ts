/**
 * Spec 02 slices 1–2. Real migration SQL via createTestDb (PGlite), the same
 * harness as audit-store.integration.test.ts. The apply function is one
 * statement; these tests pin the limit, all-or-nothing scopes, one warn per
 * window, and shadow mode.
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AuditRowSignable, DrizzleAuditStore } from '../audit-store.js';
import { recordBudgetSpend, reserveBudget, resolveBudgetIncident } from '../budgets/reserve.js';
import { windowStart } from '../budgets/windows.js';
import type { Database } from '../client/index.js';
import { claimNext } from '../jobs/claim.js';
import { accounts } from '../schema/accounts.js';
import { auditLog } from '../schema/audit-log.js';
import { budgetIncidents, budgetLedgers, budgetPolicies } from '../schema/budgets.js';
import { jobs } from '../schema/jobs.js';
import { createTestDb, seedTestUser, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
let userId = '';

beforeAll(async () => {
  testDb = await createTestDb();
  const user = await seedTestUser(testDb.drizzle, { name: 'Budget Owner' });
  userId = user.id;
});

afterAll(async () => {
  await testDb.close();
});

function causeMessage(err: unknown): string {
  if (err instanceof Error && err.cause instanceof Error) return err.cause.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function makeAccount(): Promise<string> {
  const id = randomUUID();
  await testDb.drizzle.insert(accounts).values({
    id,
    name: 'Budget Account',
    slug: `budget-${id}`,
  });
  return id;
}

async function insertPolicy(
  accountId: string,
  overrides: Partial<typeof budgetPolicies.$inferInsert> = {},
): Promise<string> {
  const id = randomUUID();
  await testDb.drizzle.insert(budgetPolicies).values({
    id,
    accountId,
    scopeType: 'account',
    scopeId: accountId,
    metric: 'tasks',
    windowKind: 'calendar_month_utc',
    limitAmount: 5,
    warnPercent: null,
    hardStop: true,
    isActive: true,
    createdByUserId: userId,
    updatedByUserId: userId,
    ...overrides,
  });
  return id;
}

async function spentOf(policyId: string): Promise<number> {
  const rows = await testDb.drizzle
    .select()
    .from(budgetLedgers)
    .where(eq(budgetLedgers.policyId, policyId));
  return rows.reduce((sum, row) => sum + row.spent, 0);
}

describe('budget schema', () => {
  it('rejects an unknown scope, metric, and job state, and accepts cancelled', async () => {
    const accountId = await makeAccount();
    let rejected = false;
    try {
      await insertPolicy(accountId, { scopeType: 'fleet' as 'account' });
    } catch (err) {
      rejected = true;
      expect(causeMessage(err)).toContain('budget_policies_scope_type_check');
    }
    expect(rejected).toBe(true);

    const cancelledId = randomUUID();
    const createdId = randomUUID();
    await testDb.drizzle.insert(jobs).values([
      { id: cancelledId, name: 'agent.dispatch', data: { ticketId: 't' }, state: 'cancelled' },
      { id: createdId, name: 'agent.dispatch', data: { ticketId: 'live' }, state: 'created' },
    ]);
    const claimed = await claimNext({
      db: testDb.drizzle as unknown as Database,
      workerId: 'budget-test',
    });
    expect(claimed?.id).toBe(createdId);
    expect(claimed?.state).toBe('active');
  });

  it('removes policies and incidents when the account is deleted', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, { limitAmount: 1, metric: 'tasks' });
    await reserveBudget(testDb.drizzle, {
      accountId,
      scopes: [{ scopeType: 'account', scopeId: accountId }],
      metric: 'tasks',
      units: 1,
      mode: 'enforce',
    });
    await reserveBudget(testDb.drizzle, {
      accountId,
      scopes: [{ scopeType: 'account', scopeId: accountId }],
      metric: 'tasks',
      units: 1,
      mode: 'enforce',
    });
    await testDb.drizzle.delete(accounts).where(eq(accounts.id, accountId));
    const policies = await testDb.drizzle
      .select()
      .from(budgetPolicies)
      .where(eq(budgetPolicies.id, policyId));
    const incidents = await testDb.drizzle
      .select()
      .from(budgetIncidents)
      .where(eq(budgetIncidents.policyId, policyId));
    expect(policies).toHaveLength(0);
    expect(incidents).toHaveLength(0);
  });
});

describe('budget reserve and record', () => {
  const at = new Date('2026-09-15T18:00:00.000Z');

  it('never lets concurrent reserves spend past the limit', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, { limitAmount: 5, metric: 'governed_actions' });
    const scopes = [{ scopeType: 'account' as const, scopeId: accountId }];
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        reserveBudget(testDb.drizzle, {
          accountId,
          scopes,
          metric: 'governed_actions',
          units: 1,
          at,
          mode: 'enforce',
        }),
      ),
    );
    const allowed = results.filter((result) => result.allowed);
    expect(allowed).toHaveLength(5);
    expect(await spentOf(policyId)).toBe(5);
    const hard = await testDb.drizzle
      .select()
      .from(budgetIncidents)
      .where(eq(budgetIncidents.policyId, policyId));
    expect(hard.filter((row) => row.thresholdType === 'hard_stop')).toHaveLength(1);
  });

  it('reserves every scope or none of them', async () => {
    const accountId = await makeAccount();
    const agentId = 'registered-agent-1';
    const accountPolicy = await insertPolicy(accountId, { limitAmount: 10, metric: 'tasks' });
    const agentPolicy = await insertPolicy(accountId, {
      scopeType: 'agent',
      scopeId: agentId,
      limitAmount: 2,
      metric: 'tasks',
    });
    const scopes = [
      { scopeType: 'account' as const, scopeId: accountId },
      { scopeType: 'agent' as const, scopeId: agentId },
    ];
    for (let i = 0; i < 3; i += 1) {
      await reserveBudget(testDb.drizzle, {
        accountId,
        scopes,
        metric: 'tasks',
        units: 1,
        at,
        mode: 'enforce',
      });
    }
    expect(await spentOf(accountPolicy)).toBe(2);
    expect(await spentOf(agentPolicy)).toBe(2);
  });

  it('opens one warn per window, then one hard stop, and a raised limit resumes', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, {
      metric: 'cost_micros',
      limitAmount: 10,
      warnPercent: 80,
      windowKind: 'calendar_month_utc',
    });
    const scopes = [{ scopeType: 'account' as const, scopeId: accountId }];
    const base = {
      accountId,
      scopes,
      metric: 'cost_micros' as const,
      at,
      mode: 'enforce' as const,
    };
    await recordBudgetSpend(testDb.drizzle, { ...base, units: 7 });
    const warned = await recordBudgetSpend(testDb.drizzle, { ...base, units: 1 });
    await recordBudgetSpend(testDb.drizzle, { ...base, units: 1 });
    const tripped = await recordBudgetSpend(testDb.drizzle, { ...base, units: 2 });
    const incidents = await testDb.drizzle
      .select()
      .from(budgetIncidents)
      .where(eq(budgetIncidents.policyId, policyId));
    expect(incidents.filter((row) => row.thresholdType === 'warn')).toHaveLength(1);
    expect(incidents.filter((row) => row.thresholdType === 'hard_stop')).toHaveLength(1);
    expect(warned.incidentsOpened.map((row) => row.thresholdType)).toEqual(['warn']);
    expect(tripped.wouldPause).toBe(true);
    expect(await spentOf(policyId)).toBe(11);

    const hard = incidents.find((row) => row.thresholdType === 'hard_stop');
    expect(hard?.status).toBe('open');
    await testDb.drizzle
      .update(budgetPolicies)
      .set({ limitAmount: 20 })
      .where(eq(budgetPolicies.id, policyId));
    const resolved = await resolveBudgetIncident(testDb.drizzle, {
      accountId,
      incidentId: hard?.id ?? '',
      resolution: 'limit_raised',
      actorUserId: userId,
    });
    expect(resolved.resolved).toBe(true);
    const again = await recordBudgetSpend(testDb.drizzle, { ...base, units: 1 });
    expect(again.incidentsOpened).toHaveLength(0);
    expect(await spentOf(policyId)).toBe(12);
  });

  it('shadow records the would-be hard stop and still allows the reserve', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, { limitAmount: 1, metric: 'tasks' });
    const scopes = [{ scopeType: 'account' as const, scopeId: accountId }];
    const signed: AuditRowSignable[] = [];
    const store = new DrizzleAuditStore(testDb.drizzle as unknown as Database, (row) => {
      signed.push(row);
      return `v1.test.${row.sequence}`;
    });
    const first = await reserveBudget(
      testDb.drizzle,
      { accountId, scopes, metric: 'tasks', units: 1, at, mode: 'shadow' },
      store,
    );
    const second = await reserveBudget(
      testDb.drizzle,
      { accountId, scopes, metric: 'tasks', units: 1, at, mode: 'shadow', runId: 'run-1' },
      store,
    );
    expect(first.allowed).toBe(true);
    expect(first.wouldDeny).toBe(false);
    expect(second.allowed).toBe(true);
    expect(second.wouldDeny).toBe(true);
    expect(second.reason).toBe('budget_hard_stop');
    expect(await spentOf(policyId)).toBe(1);
    const denial = signed.find((row) => row.eventType === 'budget:would_deny');
    expect(denial?.tenant).toBe(accountId);
    expect(denial?.severity).toBe('info');
    const stored = await testDb.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventType, 'budget:would_deny'));
    const row = stored.find((entry) => entry.tenant === accountId);
    expect(row?.signature?.startsWith('v1.test.')).toBe(true);
    expect(row?.tenant).toBe(accountId);
  });

  it('off mode does not write a ledger', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, { limitAmount: 1, metric: 'tasks' });
    const decision = await reserveBudget(testDb.drizzle, {
      accountId,
      scopes: [{ scopeType: 'account', scopeId: accountId }],
      metric: 'tasks',
      units: 1,
      at,
      mode: 'off',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.wouldDeny).toBe(false);
    expect(await spentOf(policyId)).toBe(0);
  });

  it('buckets a month in UTC when the session time zone is ahead of UTC', async () => {
    const accountId = await makeAccount();
    const policyId = await insertPolicy(accountId, {
      metric: 'tasks',
      limitAmount: 3,
      windowKind: 'calendar_month_utc',
    });
    const stamp = new Date('2026-09-01T12:00:00.000Z');
    await testDb.pglite.exec("SET TIME ZONE 'Pacific/Kiritimati'");
    try {
      await reserveBudget(testDb.drizzle, {
        accountId,
        scopes: [{ scopeType: 'account', scopeId: accountId }],
        metric: 'tasks',
        units: 1,
        at: stamp,
        mode: 'enforce',
      });
      const [ledger] = await testDb.drizzle
        .select()
        .from(budgetLedgers)
        .where(eq(budgetLedgers.policyId, policyId));
      expect(ledger?.windowStart.toISOString()).toBe(
        windowStart('calendar_month_utc', stamp).toISOString(),
      );
    } finally {
      await testDb.pglite.exec("SET TIME ZONE 'UTC'");
    }
  });
});
