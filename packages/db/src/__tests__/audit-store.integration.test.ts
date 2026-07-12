/**
 * Integration coverage for the REAL `audit_log` CHECK constraint.
 *
 * `audit-store.test.ts` (the sibling in this directory) builds its db from
 * `vi.fn()` — a mock can never enforce a CHECK constraint, so it cannot see
 * this bug. This file runs against `createTestDb()` (PGlite with every real
 * migration from packages/db/migrations applied), so the constraint really
 * fires.
 *
 * RevealUI audit-remediation Stage 0. `it.fails()` was tried first here and
 * rejected: it passes whenever the test body throws, for ANY reason — a
 * demonstrated false-green exists where `createTestDb()` itself fails
 * (e.g. `@revealui/db/schema` unresolved in an unbuilt workspace) and
 * `it.fails()` still reports "expected fail", without the insert — let alone
 * the CHECK constraint — ever being reached. Plain `it()` with a specific
 * `expect(...).rejects.toMatchObject({ cause: { code: '23514', ... } })`
 * cannot be satisfied by a missing import, an unbuilt package, or a typo; it
 * can only pass if the insert is actually attempted and Postgres actually
 * rejects it with exactly this SQLSTATE and constraint name.
 *
 * The harness-sanity test below must pass before the CHECK-constraint test
 * is trusted — if it doesn't, the harness itself is broken and every other
 * result here is meaningless.
 *
 * The CHECK-constraint test documents TODAY's real, current behavior and
 * currently PASSES: a value from @revealui/security's severity vocabulary is
 * rejected by the DB. That is the defect (Stage 1 must change how the
 * severity vocabulary reaches this table). Once Stage 1 lands, this exact
 * assertion becomes false and the test FAILS — forcing Stage 1's author to
 * consciously rewrite it to the new correct behavior. That failure-on-fix is
 * the acceptance-criteria mechanism, not a bug in this test. Both tests in
 * this file pass today with no wrapper and no inversion — `pnpm vitest run
 * packages/db` is part of the shared CI `test` job every other PR in this
 * repo depends on, so a red test here is never acceptable, on this branch or
 * any other, until someone consciously decides the pinned behavior should
 * change.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../../test/src/utils/drizzle-test-db.js';
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

describe('audit_log CHECK constraint — real schema (PGlite), not the vi.fn() mock', () => {
  let db: TestDb;

  // createTestDb() applies every real migration and has observed 9-19s
  // bootstrap time (see packages/test/src/utils/drizzle-test-db.ts) — done
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

  it('rejects the severity vocabulary @revealui/security/audit.ts emits with Postgres check_violation 23514 (Stage 1 must change this)', async () => {
    // AuditSeverity ('low' | 'medium' | 'high' | 'critical') is what every
    // request-level event carries — apps/server/src/middleware/audit.ts:59.
    // The audit_log CHECK constraint (packages/db/src/schema/audit-log.ts:57,
    // migration 0001_special_logan.sql) only allows
    // 'info' | 'warn' | 'critical'.
    await expect(
      db.drizzle.insert(auditLog).values(makeRow({ severity: 'low' })),
    ).rejects.toMatchObject({
      cause: { code: '23514', constraint: 'audit_log_severity_check' },
    });
  });
});
