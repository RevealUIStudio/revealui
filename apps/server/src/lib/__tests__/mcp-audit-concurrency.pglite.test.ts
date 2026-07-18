/**
 * Governed-MCP audit concurrency (GAP-355 Stage 3).
 *
 * The GAP-371 Phase-1 hash chain (a per-process `lastMcpSignature` head advanced
 * under a read-modify-write) is gone: Stage 3 signs each row independently at the
 * `DrizzleAuditStore` door, so there is no shared head to fork. This test keeps
 * the concurrency regression guard in its Stage-3 form — many `recordMcpToolAudit`
 * calls fired at once against a real migrated `audit_log` (PGlite) all land as
 * distinct rows, none dropped, each `seq` unique.
 */

import * as schema from '@revealui/db/schema';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';
import { recordMcpToolAudit } from '../mcp-audit.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

beforeAll(async () => {
  testDb = await createTestDb();
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

describe('concurrent MCP audit writes all land as distinct rows', () => {
  it('interleaved recordMcpToolAudit calls produce N rows with unique seq', async () => {
    const N = 30;
    await Promise.all(Array.from({ length: N }, (_, i) => recordMcpToolAudit(receiptInput(i))));

    const rows = await testDb.drizzle.select().from(schema.auditLog);
    expect(rows).toHaveLength(N);

    // No dropped writes and no duplicated append order.
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(N);
    const seqs = new Set(rows.map((r) => r.seq));
    expect(seqs.size).toBe(N);
  });
});
