/**
 * Integration coverage for the REAL `audit_log` CHECK constraint and the
 * DrizzleAuditStore round trip.
 *
 * `audit-store.test.ts` (the sibling in this directory) builds its db from
 * `vi.fn()` — a mock can never enforce a CHECK constraint or round-trip a
 * jsonb payload, so it cannot see this behavior. This file runs against
 * `createTestDb()` (PGlite with every real migration from packages/db/migrations
 * applied), so the constraint really fires and rows really persist.
 *
 * GAP-355 STAGE 1 (was Stage 0 characterization). Stage 0 pinned TODAY's defect
 * here: a value from @revealui/security's severity vocabulary ('low') was
 * rejected by the DB CHECK, and the write path had no boundary to map it, so
 * request-level events were 100% rejected. Stage 1 fixed that AT THE BOUNDARY
 * (apps/server/src/lib/audit-storage.ts maps low->info, medium->warn,
 * high->critical), NOT by widening the schema — the DB CHECK
 * (`info | warn | critical`, matching @revealui/ai's model) is CORRECT and
 * stays. The boundary mapping is exercised in
 * apps/server/src/lib/__tests__/audit-storage.pglite.test.ts.
 *
 * So at the packages/db level this file no longer asserts a defect. It pins the
 * schema's real contract post-Stage-1:
 *   1. the canonical DB vocabulary the boundary produces (info/warn/critical)
 *      persists and round-trips, with `signature` NULL (Stage 1 rows are
 *      honestly unsigned — signing is Stage 3);
 *   2. the CHECK constraint remains the backstop that rejects any severity
 *      outside the canonical vocabulary.
 *
 * The harness-sanity test must pass before the others are trusted — if it
 * doesn't, the harness itself is broken (e.g. `@revealui/db/schema` unresolved
 * in an unbuilt workspace) and every other result here is meaningless. A dead
 * harness must never report green.
 */
import { randomUUID } from 'node:crypto';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog } from '../schema/audit-log.js';

function makeRow(overrides: Partial<{ severity: string }> = {}) {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    eventType: 'data.read',
    severity: 'info',
    agentId: 'agent-1',
    payload: {},
    policyViolations: [],
    ...overrides,
  };
}

describe('audit_log — real schema (PGlite), not the vi.fn() mock', () => {
  let db: TestDb;

  // createTestDb() applies every real migration and has observed 9-19s
  // bootstrap time (see packages/db/src/testing/drizzle-test-db.ts) — done
  // in beforeEach/afterEach (not inside each `it()` body) so it's covered by
  // this package's vitest.config.ts `hookTimeout: 30000` rather than the
  // default 5000ms test timeout.
  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it('harness sanity: createTestDb() applies real migrations and a valid severity persists', async () => {
    await db.drizzle.insert(auditLog).values(makeRow({ severity: 'info' }));
    const rows = await db.drizzle.select().from(auditLog);
    expect(rows).toHaveLength(1);
  });

  it('persists every canonical DB severity the boundary produces, unsigned (signature NULL)', async () => {
    // These three values are exactly what the app boundary
    // (apps/server/src/lib/audit-storage.ts mapSeverityToDb) emits for the
    // security vocabulary: low->info, medium->warn, high->critical/critical.
    // Post-Stage-1 every one of them lands.
    for (const severity of ['info', 'warn', 'critical'] as const) {
      const row = makeRow({ severity });
      await db.drizzle.insert(auditLog).values(row);
      // Select the specific row by id — the table is append-only (GAP-355 Stage
      // 2 trigger), so we cannot delete between iterations to reset it.
      const [stored] = await db.drizzle.select().from(auditLog).where(eq(auditLog.id, row.id));
      expect(stored?.severity).toBe(severity);
      // Stage 1 rows are honestly unsigned — signing is Stage 3.
      expect(stored?.signature).toBeNull();
      expect(stored?.previousSignature).toBeNull();
    }
  });

  it('round-trips a stored payload through jsonb intact', async () => {
    const row = makeRow({});
    const payload = { source: 'web', nested: { a: 1, b: [2, 3] } };
    await db.drizzle.insert(auditLog).values({ ...row, payload, severity: 'info' });
    const [stored] = await db.drizzle.select().from(auditLog);
    expect(stored?.payload).toEqual(payload);
  });

  it('the CHECK constraint is the backstop: an out-of-vocabulary severity is rejected with Postgres 23514', async () => {
    // The audit_log CHECK constraint (packages/db/src/schema/audit-log.ts,
    // migration 0001_special_logan.sql) only allows 'info' | 'warn' |
    // 'critical'. Anything else — including the raw security vocabulary that is
    // now mapped at the boundary before it ever reaches here — is rejected.
    // This is the correct last line of defense, not a defect.
    await expect(
      db.drizzle.insert(auditLog).values(makeRow({ severity: 'low' })),
    ).rejects.toMatchObject({
      cause: { code: '23514', constraint: 'audit_log_severity_check' },
    });
  });

  // GAP-355 Stage 2 (ONE DOOR) — append-only is now enforced at the DB layer by
  // the migration-0026 trigger, not merely documented.
  it('append-only: UPDATE on a stored row is rejected by the trigger', async () => {
    const row = makeRow({ severity: 'info' });
    await db.drizzle.insert(auditLog).values(row);
    // The trigger RAISEs with ERRCODE 'restrict_violation' (SQLSTATE 23001); the
    // message + code land on the driver error's `cause`, same shape as the CHECK
    // test above.
    await expect(
      db.drizzle.update(auditLog).set({ severity: 'warn' }).where(eq(auditLog.id, row.id)),
    ).rejects.toMatchObject({ cause: { code: '23001' } });
  });

  it('append-only: DELETE of a stored row is rejected by the trigger', async () => {
    const row = makeRow({ severity: 'info' });
    await db.drizzle.insert(auditLog).values(row);
    await expect(db.drizzle.delete(auditLog).where(eq(auditLog.id, row.id))).rejects.toMatchObject({
      cause: { code: '23001' },
    });
    // The row is still there — the delete did not partially apply.
    const rows = await db.drizzle.select().from(auditLog).where(eq(auditLog.id, row.id));
    expect(rows).toHaveLength(1);
  });

  it('seq is DB-assigned, monotonic, and never written by the store', async () => {
    const a = makeRow({ severity: 'info' });
    const b = makeRow({ severity: 'info' });
    await db.drizzle.insert(auditLog).values(a);
    await db.drizzle.insert(auditLog).values(b);
    const [rowA] = await db.drizzle.select().from(auditLog).where(eq(auditLog.id, a.id));
    const [rowB] = await db.drizzle.select().from(auditLog).where(eq(auditLog.id, b.id));
    expect(typeof rowA?.seq).toBe('number');
    expect(rowB?.seq).toBeGreaterThan(rowA?.seq ?? 0);
  });

  it('tenant persists when supplied and is NULL by default', async () => {
    const scoped = { ...makeRow({ severity: 'info' }), tenant: 'acct_123' };
    const unscoped = makeRow({ severity: 'info' });
    await db.drizzle.insert(auditLog).values(scoped);
    await db.drizzle.insert(auditLog).values(unscoped);
    const [rowScoped] = await db.drizzle.select().from(auditLog).where(eq(auditLog.id, scoped.id));
    const [rowUnscoped] = await db.drizzle
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, unscoped.id));
    expect(rowScoped?.tenant).toBe('acct_123');
    expect(rowUnscoped?.tenant).toBeNull();
  });
});
