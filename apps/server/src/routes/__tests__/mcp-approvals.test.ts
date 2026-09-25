/**
 * Decide, list, and settings routes for governed MCP approvals.
 *
 * The decider is a session-authenticated account owner or admin.
 * The requester cannot decide their own request. An agent principal cannot
 * decide. A device token cannot decide. Free plans cannot change settings.
 * A failed audit write refuses the decision and leaves the row pending.
 */

import { randomUUID } from 'node:crypto';
import * as schema from '@revealui/db/schema';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { __resetAuditSignerForTest } from '../../lib/audit-signer.js';
import {
  configureMcpApprovalRoutes,
  createMcpApprovalRoutes,
  type McpApprovalDecisionAudit,
} from '../mcp-approvals.js';

let testDb: TestDb;
let accountId = '';
let otherAccountId = '';
let requesterId = '';
let ownerId = '';
let agentId = '';

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

const TOOL = 'kg_add_episode';
const INELIGIBLE_TOOL = 'revealui_list_sites';
const PREVIEW_SECRET = 'super-secret-preview';
const NOTE_TEXT = 'operator-note-not-for-audit';

interface Caller {
  id: string;
  role: string;
  deviceAuth?: boolean;
  session?: boolean;
  membershipRole?: string | null;
  tier?: string;
  accountId?: string | null;
}

function mount(
  caller: Caller | null,
  appendAudit?: (input: McpApprovalDecisionAudit) => Promise<void>,
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (caller) {
      c.set('user', { id: caller.id, role: caller.role });
      if (caller.session !== false) {
        c.set('session', {
          id: caller.deviceAuth ? 'device-token' : 'cookie-session',
          deviceAuth: caller.deviceAuth === true,
        });
      }
      c.set('entitlements', {
        accountId: caller.accountId === undefined ? accountId : caller.accountId,
        membershipRole: caller.membershipRole === undefined ? 'owner' : caller.membershipRole,
        tier: caller.tier ?? 'pro',
      });
    }
    await next();
  });
  app.route(
    '/api/mcp',
    createMcpApprovalRoutes({
      db: testDb.drizzle as never,
      appendAudit,
    }),
  );
  return app;
}

beforeAll(async () => {
  delete process.env.REVEALUI_AUDIT_SIGNING_KEY;
  __resetAuditSignerForTest();
  testDb = await createTestDb();
  accountId = randomUUID();
  otherAccountId = randomUUID();
  const requester = await seedTestUser(testDb.drizzle, {
    name: 'Approval Requester',
    role: 'owner',
  });
  const owner = await seedTestUser(testDb.drizzle, { name: 'Approval Owner', role: 'owner' });
  const agent = await seedTestUser(testDb.drizzle, { name: 'Approval Agent', role: 'agent' });
  requesterId = requester.id;
  ownerId = owner.id;
  agentId = agent.id;
  await testDb.drizzle.insert(schema.accounts).values([
    { id: accountId, name: 'Approval Account', slug: `approval-${accountId}` },
    { id: otherAccountId, name: 'Other Account', slug: `approval-${otherAccountId}` },
  ]);
}, 60_000);

afterEach(async () => {
  configureMcpApprovalRoutes(null);
  await testDb.drizzle.delete(schema.mcpToolApprovals);
  await testDb.drizzle.delete(schema.mcpApprovalSettings);
});

afterAll(async () => {
  configureMcpApprovalRoutes(null);
  await testDb.close();
});

async function insertApproval(overrides?: Partial<typeof schema.mcpToolApprovals.$inferInsert>) {
  const id = overrides?.id ?? randomUUID();
  await testDb.drizzle.insert(schema.mcpToolApprovals).values({
    id,
    accountId,
    requesterUserId: requesterId,
    clientName: 'studio',
    mcpSessionId: 'mcp-session-1',
    tool: TOOL,
    argsHash: 'a'.repeat(64),
    toolSchemaHash: 'b'.repeat(64),
    callDigest: 'c'.repeat(64),
    argsPreview: { episode: 'needs-human', apiKey: PREVIEW_SECRET },
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60_000),
    requestedAt: new Date(),
    ...overrides,
  });
  return id;
}

async function approvalStatus(id: string): Promise<string | undefined> {
  const [row] = await testDb.drizzle
    .select()
    .from(schema.mcpToolApprovals)
    .where(eq(schema.mcpToolApprovals.id, id));
  return row?.status;
}

function decide(app: Hono, id: string, body: { verdict: 'approved' | 'denied'; note?: string }) {
  return app.request(`/api/mcp/approvals/${id}/decide`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mcp/approvals/:id/decide', () => {
  it('refuses when the requester decides their own approval', async () => {
    const id = await insertApproval();
    const app = mount({ id: requesterId, role: 'owner', membershipRole: 'owner' });
    const res = await decide(app, id, { verdict: 'approved' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('own');
    expect(await approvalStatus(id)).toBe('pending');
  });

  it('refuses when an agent principal decides', async () => {
    const id = await insertApproval();
    const app = mount({ id: agentId, role: 'agent', membershipRole: 'admin' });
    const res = await decide(app, id, { verdict: 'approved' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('agent');
    expect(await approvalStatus(id)).toBe('pending');
  });

  it('refuses when a device token decides', async () => {
    const id = await insertApproval();
    const app = mount({ id: ownerId, role: 'owner', deviceAuth: true, membershipRole: 'owner' });
    const res = await decide(app, id, { verdict: 'denied' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('device token');
    expect(await approvalStatus(id)).toBe('pending');
  });

  it('refuses the decision when the audit write throws', async () => {
    const id = await insertApproval();
    const app = mount({ id: ownerId, role: 'admin', membershipRole: 'admin' }, async () => {
      throw new Error('audit down');
    });
    const res = await decide(app, id, { verdict: 'approved', note: NOTE_TEXT });
    expect(res.status).toBe(503);
    expect(await approvalStatus(id)).toBe('pending');
    const [row] = await testDb.drizzle
      .select()
      .from(schema.mcpToolApprovals)
      .where(eq(schema.mcpToolApprovals.id, id));
    expect(row?.decidedByUserId).toBeNull();
    expect(row?.consumeBy).toBeNull();
  });

  it('approves a pending request after the audit write and keeps raw arguments out of the audit', async () => {
    const id = await insertApproval();
    let sawPending = false;
    const app = mount({ id: ownerId, role: 'owner' }, async (input) => {
      const [row] = await testDb.drizzle
        .select()
        .from(schema.mcpToolApprovals)
        .where(eq(schema.mcpToolApprovals.id, id));
      sawPending = row?.status === 'pending';
      const encoded = JSON.stringify(input);
      expect(encoded).not.toContain(PREVIEW_SECRET);
      expect(encoded).not.toContain(NOTE_TEXT);
      expect(encoded).not.toContain('needs-human');
      expect(input.verdict).toBe('approved');
      expect(input.deciderUserId).toBe(ownerId);
      expect(input.notePresent).toBe(true);
      expect(input.approvalId).toBe(id);
      expect(input.accountId).toBe(accountId);
    });
    const res = await decide(app, id, { verdict: 'approved', note: NOTE_TEXT });
    expect(res.status).toBe(200);
    expect(sawPending).toBe(true);
    const body = (await res.json()) as { status: string; consumeBy: string | null };
    expect(body.status).toBe('approved');
    expect(body.consumeBy).toEqual(expect.any(String));
    const [row] = await testDb.drizzle
      .select()
      .from(schema.mcpToolApprovals)
      .where(eq(schema.mcpToolApprovals.id, id));
    expect(row?.status).toBe('approved');
    expect(row?.decidedByUserId).toBe(ownerId);
    expect(row?.decisionNote).toBe(NOTE_TEXT);
    expect(row?.consumeBy).toBeInstanceOf(Date);
    expect(row?.argsPreview).toMatchObject({ apiKey: PREVIEW_SECRET });
  });

  it('refuses an expired pending approval', async () => {
    const id = await insertApproval({ expiresAt: new Date(Date.now() - 1_000) });
    const calls: string[] = [];
    const app = mount({ id: ownerId, role: 'owner' }, async () => {
      calls.push('audit');
    });
    const res = await decide(app, id, { verdict: 'approved' });
    expect(res.status).toBe(409);
    expect(calls).toEqual([]);
    expect(await approvalStatus(id)).toBe('pending');
  });

  it('denies a pending approval without opening a consume window', async () => {
    const id = await insertApproval();
    const app = mount({ id: ownerId, role: 'admin', membershipRole: 'admin' });
    const res = await decide(app, id, { verdict: 'denied', note: NOTE_TEXT });
    expect(res.status).toBe(200);
    const [row] = await testDb.drizzle
      .select()
      .from(schema.mcpToolApprovals)
      .where(eq(schema.mcpToolApprovals.id, id));
    expect(row?.status).toBe('denied');
    expect(row?.consumeBy).toBeNull();
    expect(row?.decisionNote).toBe(NOTE_TEXT);
    const events = await testDb.drizzle
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.eventType, 'mcp:approval:denied'));
    const event = events.find((item) => {
      const body = item.payload as { approvalId?: string };
      return body.approvalId === id;
    });
    expect(event?.severity).toBe('warn');
    expect(event?.tenant).toBe(accountId);
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.deciderUserId).toBe(ownerId);
    expect(payload.approvalId).toBe(id);
    expect(JSON.stringify(payload)).not.toContain(NOTE_TEXT);
    expect(JSON.stringify(payload)).not.toContain(PREVIEW_SECRET);
  });

  it('writes mcp:approval:approved through the audit door without raw arguments', async () => {
    const id = await insertApproval();
    const app = mount({ id: ownerId, role: 'owner' });
    const res = await decide(app, id, { verdict: 'approved', note: NOTE_TEXT });
    expect(res.status).toBe(200);
    const events = await testDb.drizzle
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.eventType, 'mcp:approval:approved'));
    const event = events.find((item) => {
      const payload = item.payload as { approvalId?: string };
      return payload.approvalId === id;
    });
    expect(event?.severity).toBe('info');
    expect(event?.tenant).toBe(accountId);
    expect(event?.agentId).toBe('mcp:studio');
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.deciderUserId).toBe(ownerId);
    expect(payload.notePresent).toBe(true);
    expect(typeof payload.consumeBy).toBe('string');
    const encoded = JSON.stringify(payload);
    expect(encoded).not.toContain(PREVIEW_SECRET);
    expect(encoded).not.toContain(NOTE_TEXT);
    expect(encoded).not.toContain('needs-human');
  });
});

describe('approval list and detail', () => {
  it('lists pending approvals for the caller account and hides expired and foreign rows', async () => {
    const pendingId = await insertApproval({ requestedAt: new Date('2026-09-25T12:00:00.000Z') });
    const expiredId = await insertApproval({
      expiresAt: new Date(Date.now() - 5_000),
      requestedAt: new Date('2026-09-25T12:01:00.000Z'),
    });
    const foreignId = await insertApproval({ accountId: otherAccountId });
    const approvedId = await insertApproval({
      status: 'approved',
      consumeBy: new Date(Date.now() + 60_000),
    });
    const app = mount({ id: ownerId, role: 'owner' });
    const res = await app.request('/api/mcp/approvals?status=pending');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvals: Array<{ id: string; tool: string }> };
    const ids = body.approvals.map((item) => item.id);
    expect(ids).toContain(pendingId);
    expect(ids).not.toContain(expiredId);
    expect(ids).not.toContain(foreignId);
    expect(ids).not.toContain(approvedId);
    expect(body.approvals.every((item) => item.tool === TOOL)).toBe(true);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(PREVIEW_SECRET);
  });

  it('returns the redacted preview, hashes, requester, and timestamps', async () => {
    const id = await insertApproval();
    const app = mount({ id: ownerId, role: 'owner' });
    const res = await app.request(`/api/mcp/approvals/${id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tool: string;
      argsPreview: { apiKey?: string; episode?: string };
      argsHash: string;
      toolSchemaHash: string;
      callDigest: string;
      requesterUserId: string;
      requestedAt: string;
      expiresAt: string;
    };
    expect(body.tool).toBe(TOOL);
    expect(body.argsPreview.episode).toBe('needs-human');
    expect(body.argsPreview.apiKey).toBe(PREVIEW_SECRET);
    expect(body.argsHash).toBe('a'.repeat(64));
    expect(body.toolSchemaHash).toBe('b'.repeat(64));
    expect(body.callDigest).toBe('c'.repeat(64));
    expect(body.requesterUserId).toBe(requesterId);
    expect(body.requestedAt).toEqual(expect.any(String));
    expect(body.expiresAt).toEqual(expect.any(String));

    const foreign = await app.request(`/api/mcp/approvals/${randomUUID()}`);
    expect(foreign.status).toBe(404);
  });
});

describe('mount', () => {
  it('leaves the exact /api/mcp path to the governed endpoint', async () => {
    const parent = new Hono();
    parent.route('/api/mcp', createMcpApprovalRoutes({ db: testDb.drizzle as never }));
    parent.all('/api/mcp', (c) => c.text('exact-mcp'));
    const exact = await parent.request('/api/mcp', { method: 'POST' });
    expect(exact.status).toBe(200);
    expect(await exact.text()).toBe('exact-mcp');
    const list = await parent.request('/api/mcp/approvals?status=pending');
    expect(list.status).toBe(401);
  });
});

describe('PUT /api/mcp/approval-settings', () => {
  it('refuses when a free plan sets approval settings', async () => {
    const app = mount({ id: ownerId, role: 'owner', tier: 'free' });
    const res = await app.request('/api/mcp/approval-settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireTools: [TOOL] }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain('free');
    const rows = await testDb.drizzle
      .select()
      .from(schema.mcpApprovalSettings)
      .where(eq(schema.mcpApprovalSettings.accountId, accountId));
    expect(rows).toHaveLength(0);
  });

  it('rejects a tool that is not eligible and stores an eligible set for pro', async () => {
    const app = mount({ id: ownerId, role: 'owner', tier: 'pro' });
    const rejected = await app.request('/api/mcp/approval-settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireTools: [INELIGIBLE_TOOL] }),
    });
    expect(rejected.status).toBe(400);

    const saved = await app.request('/api/mcp/approval-settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requireTools: ['revealui_session_patch', TOOL, 'revealui_session_open'],
      }),
    });
    expect(saved.status).toBe(200);
    const written = (await saved.json()) as { requireTools: string[] };
    expect(written.requireTools).toEqual(['revealui_session_patch', TOOL, 'revealui_session_open']);

    const listed = await app.request('/api/mcp/approval-settings');
    expect(listed.status).toBe(200);
    const again = (await listed.json()) as { requireTools: string[] };
    expect(again.requireTools).toEqual(written.requireTools);
  });
});
