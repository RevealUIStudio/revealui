/**
 * Integration coverage for the REAL `audit_log` CHECK constraint.
 *
 * `audit-store.test.ts` (the sibling in this directory) builds its db from
 * `vi.fn()` — a mock can never enforce a CHECK constraint, so it cannot see
 * this bug. This file runs against `createTestDb()` (PGlite with every real
 * migration from packages/db/migrations applied), so the constraint really
 * fires.
 *
 * RevealUI audit-remediation Stage 0: an audit write can fail for several
 * distinct reasons and today they all produce identical silence. This test
 * documents one of them at the schema level — Stage 1 fixes it.
 *
 * Wrapped in `it.fails()` (Vitest's native "expected to fail" API — the repo
 * has no existing red-first-test convention to match, so this was the
 * closest built-in fit): the assertion states the DESIRED post-Stage-1
 * behavior (a value from @revealui/security's severity vocabulary can be
 * persisted). Today that insert throws with Postgres 23514, so the plain
 * assertion fails — that failure is the proof this test exists to capture.
 * `it.fails()` inverts pass/fail so CI stays green until Stage 1 removes the
 * wrapper (at which point the bare assertion becomes the acceptance test).
 */
import { randomUUID } from 'node:crypto';
import { describe, it } from 'vitest';
import { createTestDb } from '../../../test/src/utils/drizzle-test-db.js';
import { auditLog } from '../schema/audit-log.js';

describe('audit_log CHECK constraint — real schema (PGlite), not the vi.fn() mock', () => {
  it.fails('accepts the severity vocabulary @revealui/security/audit.ts emits (Stage 1)', async () => {
    const db = await createTestDb();
    try {
      // AuditSeverity ('low' | 'medium' | 'high' | 'critical') is what every
      // request-level event carries — apps/server/src/middleware/audit.ts:59.
      // The audit_log CHECK constraint (packages/db/src/schema/audit-log.ts:57,
      // migration 0001_special_logan.sql:15) only allows
      // 'info' | 'warn' | 'critical'. This insert throws Postgres 23514 today.
      await db.drizzle.insert(auditLog).values({
        id: randomUUID(),
        timestamp: new Date(),
        eventType: 'data.read',
        severity: 'low',
        agentId: 'agent-1',
        payload: {},
        policyViolations: [],
      });
    } finally {
      await db.close();
    }
  });
});
