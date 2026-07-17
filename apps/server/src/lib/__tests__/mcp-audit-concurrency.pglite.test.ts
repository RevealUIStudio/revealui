/**
 * Finding-1 (GAP-371 Phase-1 review MUST-FIX) — the governed-MCP audit chain
 * head is a read-modify-write across the insert `await`. Concurrent
 * `recordMcpToolAudit` calls that both read the same head before either advances
 * it FORK the hash chain (two rows chained to one parent). Phase 2 turns on the
 * fail-closed mutating-audit path, so every append is on the hot path.
 *
 * This test interleaves many `recordMcpToolAudit` calls against a real migrated
 * `audit_log` (PGlite) and asserts the resulting rows form ONE unbroken,
 * unforked, tamper-evident chain via `verifyMcpAuditChain`. Without the
 * serialization fix it fails: multiple rows carry `previousSignature === null`
 * (multiple roots) and the verifier reports a fork.
 */

import * as schema from '@revealui/db/schema';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import {
  __resetMcpAuditChainForTest,
  type McpAuditChainRow,
  recordMcpToolAudit,
  verifyMcpAuditChain,
} from '../mcp-audit.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

const SECRET = 'test-secret-value-at-least-32-chars-long!!';

beforeAll(async () => {
  process.env.REVEALUI_AUDIT_HMAC_SECRET = SECRET;
  testDb = await createTestDb();
});

afterEach(() => {
  __resetMcpAuditChainForTest();
});

function receiptInput(i: number) {
  return {
    outcome: 'invoked' as const,
    clientName: 'opencode',
    sessionId: `session-${i}`,
    userId: 'user-A',
    accountId: 'acct-A',
    tool: 'revealui_list_sites',
    argsDigest: 'd'.repeat(64),
    scalars: {},
    durationMs: i,
  };
}

describe('Finding-1: concurrent MCP audit writes keep one unforked chain', () => {
  it('interleaved recordMcpToolAudit calls form a single verifiable chain', async () => {
    __resetMcpAuditChainForTest();
    const N = 30;

    // Fire all N concurrently. Each reads the chain head BEFORE its insert await;
    // without serialization they all read the same head and fork.
    await Promise.all(Array.from({ length: N }, (_, i) => recordMcpToolAudit(receiptInput(i))));

    const rows = await testDb.drizzle.select().from(schema.auditLog);
    // No dropped writes.
    expect(rows).toHaveLength(N);

    const chainRows: McpAuditChainRow[] = rows.map((r) => ({
      timestamp: r.timestamp,
      eventType: r.eventType,
      severity: r.severity,
      agentId: r.agentId,
      payload: r.payload,
      signature: r.signature,
      previousSignature: r.previousSignature,
    }));

    // Exactly one root and no two rows chained to the same parent (fork check),
    // independent of the verifier — this is the property a race destroys.
    const roots = chainRows.filter((r) => r.previousSignature === null);
    expect(roots).toHaveLength(1);
    const parents = chainRows
      .map((r) => r.previousSignature)
      .filter((p): p is string => p !== null);
    expect(new Set(parents).size).toBe(parents.length);

    // Full tamper-evident verification: one unbroken, unforked, signed chain.
    const result = verifyMcpAuditChain(chainRows, SECRET);
    expect(result.reason).toBeUndefined();
    expect(result.valid).toBe(true);
  });
});
