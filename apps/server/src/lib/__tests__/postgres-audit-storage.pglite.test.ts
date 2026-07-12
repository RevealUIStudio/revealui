/**
 * Integration coverage for `PostgresAuditStorage` against a REAL, migrated
 * schema (PGlite), not a `vi.fn()` mock. Follows the same
 * `vi.mock('@revealui/db', () => ({ getClient: () => testDb.drizzle }))`
 * pattern already used by `webhook-pglite.test.ts` /
 * `dunning-lifecycle.pglite.test.ts` in this repo.
 *
 * `packages/db/src/__tests__/audit-store.integration.test.ts` covers the
 * severity-vocabulary CHECK-constraint bug at the schema level (owned by
 * packages/db). The three bugs here are specific to THIS class's private
 * module state (the HMAC signing chain, `lastSignature`) and live in
 * apps/server, so they're tested here rather than from packages/db — testing
 * them from packages/db would require packages/db to import apps/server
 * source, an illegal reverse dependency in this monorepo.
 *
 * RevealUI audit-remediation Stage 0: these are red-first tests documenting
 * bugs Stage 1 fixes. Wrapped in `it.fails()` (Vitest's native
 * "expected to fail" API) so CI stays green until Stage 1 removes the
 * wrapper — see the sibling packages/db test for the same convention
 * decision.
 */
import { randomUUID } from 'node:crypto';
import type { AuditEvent } from '@revealui/security';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return { ...actual, getClient: () => testDb.drizzle };
});

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'data.read',
    severity: 'critical',
    actor: { id: 'agent-1', type: 'system' },
    action: 'test',
    result: 'success',
    ...overrides,
  };
}

describe('PostgresAuditStorage — real PGlite schema, not a vi.fn() mock', () => {
  let PostgresAuditStorage: typeof import('../postgres-audit-storage.js').PostgresAuditStorage;
  let verifyAuditSignature: typeof import('../postgres-audit-storage.js').verifyAuditSignature;

  beforeEach(async () => {
    process.env.REVEALUI_AUDIT_HMAC_SECRET = 'a'.repeat(32);
    testDb = await createTestDb();
    vi.resetModules();
    const mod = await import('../postgres-audit-storage.js');
    PostgresAuditStorage = mod.PostgresAuditStorage;
    verifyAuditSignature = mod.verifyAuditSignature;
  });

  afterEach(async () => {
    await testDb.close();
    delete process.env.REVEALUI_AUDIT_HMAC_SECRET;
  });

  it.fails('persists every severity apps/server/src/middleware/audit.ts emits (Stage 1)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // The request middleware emits exactly these three severities
    // (apps/server/src/middleware/audit.ts:59). Mirror the middleware's own
    // catch-and-swallow (apps/server/src/middleware/audit.ts:80) so this test
    // observes what production actually persists, not an unhandled rejection.
    for (const severity of ['low', 'medium', 'high'] as const) {
      await store.write(makeEvent({ severity })).catch(() => {});
    }

    const rows = await testDb.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(3);
  });

  it.fails('round-trips a payload through jsonb without breaking the signature (Stage 1)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // 'z' then 'a' (same length) — Postgres jsonb normalizes object key
    // order on storage, so the keys come back in a different order than
    // they were written in. Severity 'critical' is valid in both the
    // security package's vocabulary AND the DB CHECK constraint, so this
    // write succeeds and isolates the jsonb round-trip bug specifically.
    const event = makeEvent({ metadata: { z: 1, a: 2 } });
    await store.write(event);

    const [row] = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.id, event.id));
    expect(row).toBeDefined();
    expect(row?.signature).not.toBeNull();

    const verified = verifyAuditSignature(
      {
        timestamp: row?.timestamp.toISOString() ?? '',
        eventType: row?.eventType ?? '',
        severity: row?.severity ?? '',
        agentId: row?.agentId ?? '',
        payload: row?.payload,
      },
      row?.signature ?? '',
      row?.previousSignature ?? null,
    );
    expect(verified).toBe(true);
  });

  it.fails('does not advance the chain head on a rejected insert (Stage 1)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // Rejected insert: 'low' is not in the audit_log CHECK vocabulary.
    await store.write(makeEvent({ severity: 'low' })).catch(() => {});

    // Immediately follow with a valid insert.
    const validEvent = makeEvent({ severity: 'critical' });
    await store.write(validEvent);

    const [row] = await testDb.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, validEvent.id));

    // Nothing was ever actually persisted before this row (the rejected
    // write never landed), so its previous_signature must be null. Today it
    // isn't: postgres-audit-storage.ts assigns `lastSignature` from the
    // rejected write's computed signature BEFORE the insert that throws, so
    // the module-level chain head advances on a write that never landed.
    expect(row?.previousSignature).toBeNull();
  });
});
