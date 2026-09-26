/**
 * Server gate for exact-call MCP approvals.
 *
 * Consume is one conditional UPDATE. A second concurrent retry must not
 * also succeed. Empty principals never become an approval row. Argument
 * previews are redacted before insert. Lookups are scoped to the caller
 * account.
 */

import { randomUUID } from 'node:crypto';
import type { Database } from '@revealui/db/client';
import * as schema from '@revealui/db/schema';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { hashMcpArguments, hashMcpCallDigest } from '@revealui/mcp/approvals';
import { REDACTED } from '@revealui/security';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { __resetAuditSignerForTest } from '../audit-signer.js';
import { createMcpApprovalGate } from '../mcp-approval-gate.js';
import { configureMcpApprovalsMode } from '../mcp-approvals-mode.js';

let testDb: TestDb;
let accountId = '';
let otherAccountId = '';
let userId = '';
let otherUserId = '';

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

const TOOL = 'kg_add_episode';
const SCHEMA_HASH = 'b'.repeat(64);
const OTHER_SCHEMA_HASH = 'd'.repeat(64);

function ctxFor(user: string, account: string | null) {
  return {
    authInfo: {
      extra: {
        userId: user,
        accountId: account,
        role: 'agent',
        tier: 'pro' as const,
      },
    },
    sessionId: 'mcp-session-1',
  };
}

function digestFor(argsHash: string, schemaHash: string, account: string, user: string): string {
  return hashMcpCallDigest({
    tool: TOOL,
    argsHash,
    toolSchemaHash: schemaHash,
    accountId: account,
    requesterUserId: user,
  });
}

beforeAll(async () => {
  delete process.env.REVEALUI_AUDIT_SIGNING_KEY;
  __resetAuditSignerForTest();
  testDb = await createTestDb();
  accountId = randomUUID();
  otherAccountId = randomUUID();
  const requester = await seedTestUser(testDb.drizzle, { name: 'Approval Requester' });
  const other = await seedTestUser(testDb.drizzle, { name: 'Other Requester' });
  userId = requester.id;
  otherUserId = other.id;
  await testDb.drizzle.insert(schema.accounts).values([
    { id: accountId, name: 'Approval Account', slug: `approval-${accountId}` },
    { id: otherAccountId, name: 'Other Account', slug: `approval-${otherAccountId}` },
  ]);
  await testDb.drizzle.insert(schema.mcpApprovalSettings).values({
    accountId,
    requireTools: [TOOL, 'revealui_session_open'],
    updatedByUserId: userId,
  });
});

afterEach(() => {
  configureMcpApprovalsMode(null);
});

afterAll(async () => {
  configureMcpApprovalsMode(null);
  await testDb.close();
});

async function approvalRows() {
  return testDb.drizzle
    .select()
    .from(schema.mcpToolApprovals)
    .where(eq(schema.mcpToolApprovals.accountId, accountId));
}

async function auditEvents(eventType: string) {
  return testDb.drizzle
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.eventType, eventType));
}

describe('mcp approval gate', () => {
  it('does nothing when the mode is off', async () => {
    configureMcpApprovalsMode('off');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'off-mode' };
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'allow' });
    const rows = await approvalRows();
    expect(rows.some((row) => row.argsHash === hashMcpArguments(args))).toBe(false);
  });

  it('inserts a pending approval and refuses the call when none is approved', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'needs-human', apiKey: 'super-secret-value' };
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });

    expect(decision.decision).toBe('approval_required');
    if (decision.decision !== 'approval_required') return;
    const rows = await approvalRows();
    const row = rows.find((item) => item.id === decision.approvalId);
    expect(row?.status).toBe('pending');
    expect(row?.accountId).toBe(accountId);
    expect(row?.requesterUserId).toBe(userId);
    expect(row?.argsPreview).toMatchObject({
      episode: 'needs-human',
      apiKey: REDACTED,
    });
    expect(JSON.stringify(row?.argsPreview)).not.toContain('super-secret-value');

    const requested = await auditEvents('mcp:approval:requested');
    expect(requested.some((event) => event.tenant === accountId)).toBe(true);
    const payload = requested.find((event) => {
      const body = event.payload as { approvalId?: string };
      return body.approvalId === decision.approvalId;
    })?.payload as Record<string, unknown>;
    expect(payload.argsHash).toBe(hashMcpArguments(args));
    expect(JSON.stringify(payload)).not.toContain('super-secret-value');
    expect(JSON.stringify(payload)).not.toContain('needs-human');
  });

  it('does not create an approval for an empty account or requester', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'no-principal' };
    const input = {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    };
    const missingAccount = await gate(ctxFor(userId, null), input);
    const emptyUser = await gate(ctxFor('   ', accountId), input);
    expect(missingAccount).toEqual({ decision: 'deny', reason: 'approval_ineligible' });
    expect(emptyUser).toEqual({ decision: 'deny', reason: 'approval_ineligible' });
    const rows = await testDb.drizzle.select().from(schema.mcpToolApprovals);
    expect(rows.some((row) => row.argsHash === input.argsHash)).toBe(false);
  });

  it('consumes one matching approval and refuses the second retry', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'consume-once' };
    const argsHash = hashMcpArguments(args);
    const id = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'consume-once' },
      status: 'approved',
      expiresAt: new Date(Date.now() + 60_000),
      consumeBy: new Date(Date.now() + 60_000),
    });

    const input = {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      approvalId: id,
      clientName: 'studio',
    };
    const first = await gate(ctxFor(userId, accountId), input);
    const second = await gate(ctxFor(userId, accountId), input);
    expect(first).toEqual({ decision: 'allow' });
    expect(second).toEqual({ decision: 'deny', reason: 'approval_already_consumed' });

    const [row] = await testDb.drizzle
      .select()
      .from(schema.mcpToolApprovals)
      .where(eq(schema.mcpToolApprovals.id, id));
    expect(row?.status).toBe('consumed');
    const consumed = await auditEvents('mcp:approval:consumed');
    expect(
      consumed.filter((event) => (event.payload as { approvalId?: string }).approvalId === id),
    ).toHaveLength(1);
  });

  it('lets only one of two concurrent consumes win', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'concurrent' };
    const argsHash = hashMcpArguments(args);
    const id = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'concurrent' },
      status: 'approved',
      expiresAt: new Date(Date.now() + 60_000),
      consumeBy: new Date(Date.now() + 60_000),
    });
    const input = {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      approvalId: id,
      clientName: 'studio',
    };
    const [left, right] = await Promise.all([
      gate(ctxFor(userId, accountId), input),
      gate(ctxFor(userId, accountId), input),
    ]);
    const allows = [left, right].filter((decision) => decision.decision === 'allow');
    expect(allows).toHaveLength(1);
  });

  it('refuses a retry whose arguments no longer match', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const approvedArgs = { episode: 'original' };
    const approvedHash = hashMcpArguments(approvedArgs);
    const id = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash: approvedHash,
      toolSchemaHash: SCHEMA_HASH,
      callDigest: digestFor(approvedHash, SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'original' },
      status: 'approved',
      expiresAt: new Date(Date.now() + 60_000),
      consumeBy: new Date(Date.now() + 60_000),
    });
    const changed = { episode: 'changed' };
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args: changed,
      argsHash: hashMcpArguments(changed),
      toolSchemaHash: SCHEMA_HASH,
      approvalId: id,
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'deny', reason: 'approval_args_mismatch' });
    const [row] = await testDb.drizzle
      .select()
      .from(schema.mcpToolApprovals)
      .where(eq(schema.mcpToolApprovals.id, id));
    expect(row?.status).toBe('approved');
  });

  it('refuses a different account without revealing the row', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'other-account' };
    const argsHash = hashMcpArguments(args);
    const id = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'other-account' },
      status: 'approved',
      expiresAt: new Date(Date.now() + 60_000),
      consumeBy: new Date(Date.now() + 60_000),
    });
    await testDb.drizzle.insert(schema.mcpApprovalSettings).values({
      accountId: otherAccountId,
      requireTools: [TOOL],
      updatedByUserId: otherUserId,
    });
    const decision = await gate(ctxFor(otherUserId, otherAccountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      approvalId: id,
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'deny', reason: 'approval_wrong_principal' });
  });

  it('refuses an expired approval and a different requester in the same account', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'expired' };
    const argsHash = hashMcpArguments(args);
    const expiredId = randomUUID();
    const foreignId = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values([
      {
        id: expiredId,
        accountId,
        requesterUserId: userId,
        clientName: 'studio',
        tool: TOOL,
        argsHash,
        toolSchemaHash: SCHEMA_HASH,
        callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
        argsPreview: { episode: 'expired' },
        status: 'approved',
        expiresAt: new Date(Date.now() - 60_000),
        consumeBy: new Date(Date.now() - 1_000),
      },
      {
        id: foreignId,
        accountId,
        requesterUserId: userId,
        clientName: 'studio',
        tool: TOOL,
        argsHash,
        toolSchemaHash: SCHEMA_HASH,
        callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
        argsPreview: { episode: 'expired' },
        status: 'approved',
        expiresAt: new Date(Date.now() + 60_000),
        consumeBy: new Date(Date.now() + 60_000),
      },
    ]);
    const expired = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      approvalId: expiredId,
      clientName: 'studio',
    });
    const wrongUser = await gate(ctxFor(otherUserId, accountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      approvalId: foreignId,
      clientName: 'studio',
    });
    expect(expired).toEqual({ decision: 'deny', reason: 'approval_expired' });
    expect(wrongUser).toEqual({ decision: 'deny', reason: 'approval_wrong_principal' });
  });

  it('marks a pending row expired when the requested audit write fails', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({
      db: testDb.drizzle as unknown as Database,
      appendAudit: async () => {
        throw new Error('audit down');
      },
    });
    const args = { episode: 'audit-fail' };
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'deny', reason: 'approval_audit_failed' });
    const rows = await approvalRows();
    const row = rows.find((item) => {
      const preview = item.argsPreview as { episode?: string };
      return preview.episode === 'audit-fail';
    });
    expect(row?.status).toBe('expired');
  });

  it('logs would-require in shadow mode and still allows the call', async () => {
    configureMcpApprovalsMode('shadow');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'observe-only' };
    const before = (await approvalRows()).length;
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'allow' });
    expect(await approvalRows()).toHaveLength(before);
    const would = await auditEvents('mcp:approval:would_require');
    expect(would.length).toBeGreaterThan(0);
    expect(JSON.stringify(would.at(-1)?.payload)).not.toContain('observe-only');
  });

  it('logs would-deny in shadow mode and still allows the call', async () => {
    configureMcpApprovalsMode('shadow');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'shadow-deny' };
    const decision = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash: hashMcpArguments(args),
      toolSchemaHash: SCHEMA_HASH,
      approvalId: randomUUID(),
      clientName: 'studio',
    });
    expect(decision).toEqual({ decision: 'allow' });
    const would = await auditEvents('mcp:approval:would_deny');
    expect(would.length).toBeGreaterThan(0);
    expect(JSON.stringify(would.at(-1)?.payload)).not.toContain('shadow-deny');
  });

  it('matches an active trust rule and lapses it when the schema hash changes', async () => {
    configureMcpApprovalsMode('enforce');
    const gate = createMcpApprovalGate({ db: testDb.drizzle as unknown as Database });
    const args = { episode: 'trusted' };
    const argsHash = hashMcpArguments(args);
    const sourceId = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id: sourceId,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      callDigest: digestFor(argsHash, SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'trusted' },
      status: 'consumed',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    });
    const ruleId = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolTrustRules).values({
      id: ruleId,
      accountId,
      sourceApprovalId: sourceId,
      requesterUserId: userId,
      tool: TOOL,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      maxUses: 1,
      uses: 0,
      createdByUserId: userId,
    });

    const allowed = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(allowed).toEqual({ decision: 'allow' });
    const [used] = await testDb.drizzle
      .select()
      .from(schema.mcpToolTrustRules)
      .where(eq(schema.mcpToolTrustRules.id, ruleId));
    expect(used?.uses).toBe(1);

    const lapsedRuleId = randomUUID();
    const lapsedSource = randomUUID();
    await testDb.drizzle.insert(schema.mcpToolApprovals).values({
      id: lapsedSource,
      accountId,
      requesterUserId: userId,
      clientName: 'studio',
      tool: TOOL,
      argsHash,
      toolSchemaHash: OTHER_SCHEMA_HASH,
      callDigest: digestFor(argsHash, OTHER_SCHEMA_HASH, accountId, userId),
      argsPreview: { episode: 'trusted' },
      status: 'consumed',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    });
    await testDb.drizzle.insert(schema.mcpToolTrustRules).values({
      id: lapsedRuleId,
      accountId,
      sourceApprovalId: lapsedSource,
      requesterUserId: userId,
      tool: TOOL,
      argsHash,
      toolSchemaHash: OTHER_SCHEMA_HASH,
      createdByUserId: userId,
    });
    const beforeLapse = (await auditEvents('mcp:trust_rule:lapsed')).length;
    const required = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(required.decision).toBe('approval_required');
    const [lapsed] = await testDb.drizzle
      .select()
      .from(schema.mcpToolTrustRules)
      .where(eq(schema.mcpToolTrustRules.id, lapsedRuleId));
    expect(lapsed?.lapsedAt).toBeTruthy();
    const lapseEvents = await auditEvents('mcp:trust_rule:lapsed');
    expect(lapseEvents.length - beforeLapse).toBe(1);

    const again = await gate(ctxFor(userId, accountId), {
      tool: TOOL,
      args,
      argsHash,
      toolSchemaHash: SCHEMA_HASH,
      clientName: 'studio',
    });
    expect(again.decision).toBe('approval_required');
    expect((await auditEvents('mcp:trust_rule:lapsed')).length - beforeLapse).toBe(1);
  });
});
