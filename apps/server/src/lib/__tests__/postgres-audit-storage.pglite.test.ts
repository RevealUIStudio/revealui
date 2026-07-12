/**
 * Integration coverage for `PostgresAuditStorage` against a REAL, migrated
 * schema (PGlite), not a `vi.fn()` mock. Follows the same
 * `vi.mock('@revealui/db', () => ({ getClient: () => testDb.drizzle }))`
 * pattern already used by `webhook-pglite.test.ts` /
 * `dunning-lifecycle.pglite.test.ts` in this repo.
 *
 * `packages/db/src/__tests__/audit-store.integration.test.ts` covers the
 * severity-vocabulary CHECK-constraint bug at the schema level (owned by
 * packages/db). The bugs here are specific to THIS class's private module
 * state (the HMAC signing chain, `lastSignature`) and live in apps/server, so
 * they're tested here rather than from packages/db — testing them from
 * packages/db would require packages/db to import apps/server source, an
 * illegal reverse dependency in this monorepo.
 *
 * RevealUI audit-remediation Stage 0. Each test below pins an exact,
 * falsifiable fact about TODAY's behavior — a Postgres error code + a named
 * constraint, an exact row count, a byte-level canonical-form mismatch, or a
 * signature identity — not merely "something threw". `it.fails()` was tried
 * first and rejected: it passes on ANY throw, including a broken harness
 * (unbuilt package, missing schema import, migrations that never applied),
 * so it proves nothing. Plain `it()` with a specific `expect(...)` cannot be
 * satisfied by an unrelated failure, and a harness that cannot reach the
 * assertion fails loudly instead of reporting green.
 *
 * The severity-rejection and severity-persistence tests below currently
 * PASS: they pin the real, current (broken) behavior with enough specificity
 * that nothing except the actual documented defect can satisfy them. Stage 1
 * fixing the severity vocabulary will make these assertions false — at that
 * point they FAIL, forcing Stage 1's author to consciously rewrite them to
 * the new correct behavior. That failure-on-fix is the acceptance-criteria
 * mechanism; it is not a bug in these tests.
 *
 * The chain-head test asserts a standing invariant (previous_signature must
 * point at the last row that actually persisted) that should hold both
 * before and after Stage 1. It FAILS today for real — no wrapper, no
 * inversion — and should keep passing unmodified once Stage 1 lands.
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

/** SQLSTATE + constraint name asserted throughout — see packages/db/src/schema/audit-log.ts:57. */
const SEVERITY_CHECK_VIOLATION = {
  cause: { code: '23514', constraint: 'audit_log_severity_check' },
} as const;

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

  // ── Harness sanity ─────────────────────────────────────────────────────
  // Must run (and pass) before any of the bug-specific tests below are
  // trusted. If this fails, the harness itself is broken (unbuilt package,
  // missing @revealui/db/schema export, migrations that didn't apply, the
  // getClient() mock not wired) and every other result in this file is
  // meaningless until this is green again.

  it('harness sanity: a valid severity persists and signs', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    const event = makeEvent({ severity: 'critical' });
    await store.write(event);

    const rows = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.id, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.signature).not.toBeNull();
  });

  // ── Severity vocabulary vs the CHECK constraint ─────────────────────────

  it('every severity apps/server/src/middleware/audit.ts emits is rejected by the CHECK constraint — 0 of 3 rows land (Stage 1 must change this)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // The request middleware emits exactly these three severities
    // (apps/server/src/middleware/audit.ts:59). Capture each outcome
    // individually — do not swallow-and-count, or an unrelated failure
    // (wrong error, different cause) would be indistinguishable from the
    // real defect.
    const outcomes: Array<{ severity: 'low' | 'medium' | 'high'; error: unknown }> = [];
    for (const severity of ['low', 'medium', 'high'] as const) {
      try {
        await store.write(makeEvent({ severity }));
        outcomes.push({ severity, error: undefined });
      } catch (error) {
        outcomes.push({ severity, error });
      }
    }

    for (const { severity, error } of outcomes) {
      expect(error, `severity '${severity}' should have thrown a check_violation`).toMatchObject(
        SEVERITY_CHECK_VIOLATION,
      );
    }

    const rows = await testDb.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(0);
  });

  // ── jsonb round-trip vs the HMAC signature ──────────────────────────────

  it('the recomputed signature does not match because jsonb reorders payload.metadata keys, not because any value changed (Stage 1 must fix this)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // 'z' then 'a' (same length) — Postgres jsonb normalizes object key
    // order on storage (same-length keys sort lexically), so the keys come
    // back in a different order than they were written in. Severity
    // 'critical' is valid in both the security package's vocabulary AND the
    // DB CHECK constraint, so this write succeeds and isolates the jsonb
    // round-trip bug specifically — nothing else about the write can be the
    // cause of what follows.
    const event = makeEvent({ metadata: { z: 1, a: 2 } });
    await store.write(event);

    const [row] = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.id, event.id));
    expect(row).toBeDefined();
    if (!row) throw new Error('unreachable: guarded by the assertion above');
    expect(row.signature).not.toBeNull();

    // Every OTHER signed field round-trips identically — isolates the
    // mismatch below to payload.metadata specifically, not some other drift.
    expect(row.timestamp.toISOString()).toBe(event.timestamp);
    expect(row.eventType).toBe(event.type);
    expect(row.severity).toBe(event.severity);
    expect(row.agentId).toBe(event.actor.id);

    const roundTrippedMetadata = (row.payload as { metadata?: unknown } | null)?.metadata;
    // The VALUE is unchanged (same keys, same values) ...
    expect(roundTrippedMetadata).toEqual(event.metadata);
    // ... but the canonical (JSON.stringify) representation is NOT
    // byte-identical, because jsonb reordered the keys. This is exactly why
    // verifyAuditSignature — which recomputes the HMAC over
    // JSON.stringify(payload) — cannot reproduce the original signature at
    // read time: the bytes it hashes are provably different even though the
    // data is semantically identical.
    expect(JSON.stringify(roundTrippedMetadata)).not.toBe(JSON.stringify(event.metadata));

    const verified = verifyAuditSignature(
      {
        timestamp: row.timestamp.toISOString(),
        eventType: row.eventType,
        severity: row.severity,
        agentId: row.agentId,
        payload: row.payload,
      },
      row.signature ?? '',
      row.previousSignature,
    );
    expect(verified).toBe(false);
  });

  // ── Hash-chain head vs a rejected insert ─────────────────────────────────

  it('does not advance the chain head on a rejected insert — previous_signature must point at the last row that actually PERSISTED (Stage 1 must fix this)', async () => {
    const store = new PostgresAuditStorage();
    const { auditLog } = await import('@revealui/db/schema');

    // Establish a known-good baseline: one row that genuinely persists.
    const firstValid = makeEvent({ severity: 'critical' });
    await store.write(firstValid);
    const [firstRow] = await testDb.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, firstValid.id));
    expect(firstRow).toBeDefined();
    if (!firstRow) throw new Error('unreachable: guarded by the assertion above');
    expect(firstRow.signature).not.toBeNull();

    // Rejected insert: 'low' is not in the audit_log CHECK vocabulary.
    // Confirm both the specific rejection reason AND that it truly never
    // landed — the invariant below is meaningless if this write silently
    // persisted after all.
    const rejected = makeEvent({ severity: 'low' });
    await expect(store.write(rejected)).rejects.toMatchObject(SEVERITY_CHECK_VIOLATION);
    const rejectedRows = await testDb.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, rejected.id));
    expect(rejectedRows).toHaveLength(0);

    // Immediately follow with a second valid insert.
    const secondValid = makeEvent({ severity: 'critical' });
    await store.write(secondValid);
    const [secondRow] = await testDb.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, secondValid.id));
    expect(secondRow).toBeDefined();
    if (!secondRow) throw new Error('unreachable: guarded by the assertion above');

    // The chain head must point at the last PERSISTED row (firstRow), never
    // at the rejected write that never landed. Today it doesn't:
    // postgres-audit-storage.ts assigns the module-level `lastSignature` from
    // the rejected write's COMPUTED signature BEFORE the insert that throws,
    // so the chain head advances on a write that never made it into the
    // table. This assertion fails today and should keep passing, unmodified,
    // once Stage 1 fixes the ordering.
    expect(secondRow.previousSignature).toBe(firstRow.signature);
  });
});
