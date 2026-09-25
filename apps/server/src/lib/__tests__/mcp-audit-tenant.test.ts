/**
 * Governed MCP receipts must land on the caller's account tenant.
 *
 * `audit_log.tenant` is what the anchor sweep scopes. A receipt that only
 * puts `accountId` inside `payload` anchors under the system scope, so the
 * account cannot hold a root over its own MCP calls. This file pins the
 * column, and that the Ed25519 signature covers it.
 */

import { generateKeyPairSync } from 'node:crypto';
import { type AuditSignable, verifyAuditRow } from '@revealui/core/security';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { __resetAuditSignerForTest } from '../audit-signer.js';
import { type McpAuditInput, recordMcpToolAudit } from '../mcp-audit.js';

const SIGNING_KID = 'mcp-audit-tenant-test';

let testDb: TestDb;
let publicKeyPem = '';

const previousEnv = {
  signingKey: process.env.REVEALUI_AUDIT_SIGNING_KEY,
  signingKid: process.env.REVEALUI_AUDIT_SIGNING_KID,
  publicKey: process.env.REVEALUI_AUDIT_PUBLIC_KEY,
};

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

function receipt(overrides: Partial<McpAuditInput> = {}): McpAuditInput {
  return {
    outcome: 'invoked',
    clientName: 'studio',
    sessionId: 'session-tenant',
    userId: 'user-tenant',
    accountId: 'acct-tenant',
    tool: 'revealui_list_sites',
    argsDigest: 'a'.repeat(64),
    scalars: { collection: 'pages' },
    durationMs: 12,
    ...overrides,
  };
}

function signableFromRow(row: typeof schema.auditLog.$inferSelect): AuditSignable {
  return {
    id: row.id,
    sequence: Number(row.seq),
    tenant: row.tenant,
    timestamp: row.timestamp,
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId,
    sessionId: row.sessionId,
    payload: row.payload,
    policyViolations: row.policyViolations ?? [],
  };
}

beforeAll(async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  publicKeyPem = publicKey;
  process.env.REVEALUI_AUDIT_SIGNING_KEY = privateKey;
  process.env.REVEALUI_AUDIT_SIGNING_KID = SIGNING_KID;
  delete process.env.REVEALUI_AUDIT_PUBLIC_KEY;
  __resetAuditSignerForTest();
  testDb = await createTestDb();
});

afterAll(async () => {
  if (previousEnv.signingKey === undefined) delete process.env.REVEALUI_AUDIT_SIGNING_KEY;
  else process.env.REVEALUI_AUDIT_SIGNING_KEY = previousEnv.signingKey;
  if (previousEnv.signingKid === undefined) delete process.env.REVEALUI_AUDIT_SIGNING_KID;
  else process.env.REVEALUI_AUDIT_SIGNING_KID = previousEnv.signingKid;
  if (previousEnv.publicKey === undefined) delete process.env.REVEALUI_AUDIT_PUBLIC_KEY;
  else process.env.REVEALUI_AUDIT_PUBLIC_KEY = previousEnv.publicKey;
  __resetAuditSignerForTest();
  await testDb.close();
});

describe('governed MCP receipts record the account tenant', () => {
  it('writes tenant = accountId and signs that column', async () => {
    await recordMcpToolAudit(receipt());

    const rows = await testDb.drizzle
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.agentId, 'mcp:studio'));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('receipt row missing');

    expect(row.tenant).toBe('acct-tenant');
    expect(row.eventType).toBe('mcp:tool:invoked');
    const payload = row.payload as Record<string, unknown>;
    expect(payload.accountId).toBe('acct-tenant');
    expect(row.signature?.startsWith(`v1.ed25519.${SIGNING_KID}.`)).toBe(true);

    const verified = verifyAuditRow(signableFromRow(row), row.signature ?? '', (kid) =>
      kid === SIGNING_KID ? publicKeyPem : null,
    );
    expect(verified.valid).toBe(true);

    const moved = verifyAuditRow(
      { ...signableFromRow(row), tenant: '__system__' },
      row.signature ?? '',
      (kid) => (kid === SIGNING_KID ? publicKeyPem : null),
    );
    expect(moved.valid).toBe(false);
  });

  it('writes a null tenant when the caller has no account', async () => {
    await recordMcpToolAudit(
      receipt({
        accountId: null,
        clientName: 'studio-anon',
        sessionId: 'session-anon',
        userId: 'user-anon',
      }),
    );

    const rows = await testDb.drizzle
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.agentId, 'mcp:studio-anon'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant).toBeNull();
  });
});
