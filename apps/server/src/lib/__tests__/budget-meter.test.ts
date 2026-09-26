/**
 * Governed MCP actions count toward governed_actions budgets, and the audit
 * row is signed with tenant = accountId.
 */

import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { DrizzleAuditStore } from '@revealui/db';
import { accounts, auditLog, budgetLedgers, budgetPolicies } from '@revealui/db/schema';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { createAuditRowSignerFromEnv, verifyAuditRow } from '@revealui/security/server';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordGovernedMcpAction } from '../budget-meter.js';

let testDb: TestDb;
let userId = '';
let publicKey = '';
let signer: ReturnType<typeof createAuditRowSignerFromEnv>['signer'];

beforeAll(async () => {
  testDb = await createTestDb();
  const user = await seedTestUser(testDb.drizzle, { name: 'Meter Owner' });
  userId = user.id;
  const { privateKey, publicKey: pub } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  publicKey = pub.export({ type: 'spki', format: 'pem' }).toString();
  signer = createAuditRowSignerFromEnv({ REVEALUI_AUDIT_SIGNING_KEY: privateKeyPem }).signer;
});

afterAll(async () => {
  await testDb.close();
});

async function makeAccount(): Promise<string> {
  const id = randomUUID();
  await testDb.drizzle.insert(accounts).values({
    id,
    name: 'Meter Account',
    slug: `meter-${id}`,
  });
  return id;
}

describe('recordGovernedMcpAction', () => {
  it('does nothing in the default off mode', async () => {
    const accountId = await makeAccount();
    await testDb.drizzle.insert(budgetPolicies).values({
      id: `pol-${accountId}`,
      accountId,
      scopeType: 'account',
      scopeId: accountId,
      metric: 'governed_actions',
      windowKind: 'lifetime',
      limitAmount: 10,
      hardStop: true,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    const result = await recordGovernedMcpAction({
      accountId,
      mode: 'off',
      db: testDb.drizzle,
    });
    expect(result).toBeNull();
    const ledgers = await testDb.drizzle.select().from(budgetLedgers);
    expect(ledgers.filter((row) => row.policyId === `pol-${accountId}`)).toHaveLength(0);
  });

  it('records the account and the registered agent, and signs tenant = accountId', async () => {
    const accountId = await makeAccount();
    const agentId = 'registered-agent-meter';
    await testDb.drizzle.insert(budgetPolicies).values([
      {
        id: `pol-acct-${accountId}`,
        accountId,
        scopeType: 'account',
        scopeId: accountId,
        metric: 'governed_actions',
        windowKind: 'lifetime',
        limitAmount: 1,
        hardStop: true,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      {
        id: `pol-agent-${accountId}`,
        accountId,
        scopeType: 'agent',
        scopeId: agentId,
        metric: 'governed_actions',
        windowKind: 'lifetime',
        limitAmount: 1,
        hardStop: true,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    ]);
    if (!signer) throw new Error('expected a test audit signer');
    const store = new DrizzleAuditStore(testDb.drizzle, signer);
    await recordGovernedMcpAction({
      accountId,
      agentId,
      mode: 'enforce',
      db: testDb.drizzle,
      audit: store,
    });
    const tripped = await recordGovernedMcpAction({
      accountId,
      agentId,
      mode: 'shadow',
      db: testDb.drizzle,
      audit: store,
    });
    expect(tripped?.wouldPause).toBe(true);
    const ledgers = await testDb.drizzle
      .select()
      .from(budgetLedgers)
      .where(eq(budgetLedgers.policyId, `pol-acct-${accountId}`));
    expect(ledgers[0]?.spent).toBe(2);

    const signed = await testDb.drizzle.select().from(auditLog);
    const mine = signed.filter((row) => row.tenant === accountId);
    expect(mine.length).toBeGreaterThan(0);
    for (const row of mine) {
      expect(row.tenant).toBe(accountId);
      expect(row.signature).toBeTruthy();
      expect(
        verifyAuditRow(
          {
            id: row.id,
            sequence: row.seq,
            tenant: row.tenant,
            timestamp: row.timestamp,
            eventType: row.eventType,
            severity: row.severity,
            agentId: row.agentId,
            taskId: row.taskId,
            sessionId: row.sessionId,
            payload: row.payload,
            policyViolations: row.policyViolations ?? [],
          },
          row.signature ?? '',
          (kid) => (row.signature?.includes(kid) ? publicKey : null),
        ).valid,
      ).toBe(true);
    }
  });
});
