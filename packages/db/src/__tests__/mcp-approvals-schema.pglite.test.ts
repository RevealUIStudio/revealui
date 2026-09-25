/**
 * Storage contract for governed MCP approvals.
 *
 * Runs against the real migration SQL via PGlite. The status check, the
 * partial unique index on active trust rules, and the account cascade are
 * database constraints. Consume and lapse behavior are later slices.
 */

import { randomUUID } from 'node:crypto';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts } from '../schema/accounts.js';
import {
  MCP_TOOL_APPROVAL_STATUSES,
  mcpApprovalSettings,
  mcpToolApprovals,
  mcpToolTrustRules,
} from '../schema/mcp-approvals.js';

let testDb: TestDb;
let accountId = '';
let userId = '';

function causeMessage(err: unknown): string {
  if (err instanceof Error && err.cause instanceof Error) return err.cause.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function expectConstraint(run: () => Promise<unknown>, constraint: string): Promise<void> {
  try {
    await run();
  } catch (err) {
    expect(causeMessage(err)).toContain(constraint);
    return;
  }
  throw new Error(`expected constraint ${constraint}`);
}

beforeAll(async () => {
  testDb = await createTestDb();
  accountId = randomUUID();
  const user = await seedTestUser(testDb.drizzle, { name: 'Approval Requester' });
  userId = user.id;
  await testDb.drizzle.insert(accounts).values({
    id: accountId,
    name: 'Approval Account',
    slug: `approval-${accountId}`,
  });
});

afterAll(async () => {
  await testDb.close();
});

function approvalRow(id: string, status: (typeof MCP_TOOL_APPROVAL_STATUSES)[number] = 'pending') {
  return {
    id,
    accountId,
    requesterUserId: userId,
    clientName: 'studio',
    tool: 'kg_add_episode',
    argsHash: 'a'.repeat(64),
    toolSchemaHash: 'b'.repeat(64),
    callDigest: 'c'.repeat(64),
    argsPreview: { tool: 'kg_add_episode' },
    status,
    expiresAt: new Date('2026-09-25T01:00:00.000Z'),
  };
}

describe('mcp approval tables', () => {
  it('accepts every declared status and rejects any other', async () => {
    for (const status of MCP_TOOL_APPROVAL_STATUSES) {
      await testDb.drizzle.insert(mcpToolApprovals).values(approvalRow(randomUUID(), status));
    }

    await expectConstraint(
      () =>
        testDb.drizzle.insert(mcpToolApprovals).values({
          ...approvalRow(randomUUID()),
          status: 'open' as 'pending',
        }),
      'mcp_tool_approvals_status_check',
    );
  });

  it('allows a second trust rule for the same call only after the first is revoked or lapsed', async () => {
    const sourceId = randomUUID();
    await testDb.drizzle.insert(mcpToolApprovals).values(approvalRow(sourceId, 'approved'));

    const shared = {
      accountId,
      sourceApprovalId: sourceId,
      requesterUserId: userId,
      tool: 'kg_add_episode',
      argsHash: 'a'.repeat(64),
      toolSchemaHash: 'b'.repeat(64),
      createdByUserId: userId,
    };

    await testDb.drizzle.insert(mcpToolTrustRules).values({ id: randomUUID(), ...shared });
    await expectConstraint(
      () => testDb.drizzle.insert(mcpToolTrustRules).values({ id: randomUUID(), ...shared }),
      'mcp_tool_trust_rules_active_uq',
    );

    await testDb.drizzle
      .update(mcpToolTrustRules)
      .set({ revokedAt: new Date('2026-09-25T00:30:00.000Z'), revokedByUserId: userId })
      .where(eq(mcpToolTrustRules.sourceApprovalId, sourceId));

    await testDb.drizzle.insert(mcpToolTrustRules).values({ id: randomUUID(), ...shared });
  });

  it('stores per-account requireTools and removes approval rows when the account is deleted', async () => {
    const localAccount = randomUUID();
    const localUser = await seedTestUser(testDb.drizzle, { name: 'Settings Owner' });
    await testDb.drizzle.insert(accounts).values({
      id: localAccount,
      name: 'Settings Account',
      slug: `settings-${localAccount}`,
    });
    await testDb.drizzle.insert(mcpApprovalSettings).values({
      accountId: localAccount,
      updatedByUserId: localUser.id,
    });
    const approvalId = randomUUID();
    await testDb.drizzle.insert(mcpToolApprovals).values({
      ...approvalRow(approvalId),
      accountId: localAccount,
      requesterUserId: localUser.id,
    });

    const [settings] = await testDb.drizzle
      .select()
      .from(mcpApprovalSettings)
      .where(eq(mcpApprovalSettings.accountId, localAccount));
    expect(settings?.requireTools).toEqual([]);

    await testDb.drizzle.delete(accounts).where(eq(accounts.id, localAccount));
    const left = await testDb.drizzle
      .select()
      .from(mcpToolApprovals)
      .where(eq(mcpToolApprovals.id, approvalId));
    expect(left).toHaveLength(0);
  });
});
