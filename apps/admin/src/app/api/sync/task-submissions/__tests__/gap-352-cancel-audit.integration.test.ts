/**
 * GAP-352 — an admin must not be able to cancel a running task via the sync
 * PATCH route, because doing so races the executor's status='running'
 * completion CAS and silently destroys the audit row for a run that actually
 * happened. revmarket-executor is the ONE agent surface that writes an audit
 * row, so this bug erases the only record of the run.
 *
 * This is a real-storage integration test: the actual admin PATCH handler and
 * the actual executor `completeTask` both run against ONE migrated PGlite DB
 * (via `getClient` mocked to the shared test client, mirroring
 * apps/server/src/lib/__tests__/mcp-audit-concurrency.pglite.test.ts).
 *
 * Prove-red: on `origin/test` (pre-fix) the PATCH moves the running task to
 * 'cancelled', the executor CAS then no-ops, and no audit row is written —
 * both assertions below fail. After the fix the PATCH is rejected (400), the
 * task stays running, the executor completes it, and its audit row exists.
 */

import * as authServer from '@revealui/auth/server';
import { logger as coreLogger } from '@revealui/core/observability/logger';
import { auditLog, taskSubmissions, users } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeTask } from '../../../../../../../../apps/server/src/services/revmarket-executor.js';
import { PATCH } from '../[id]/route';

let testDb: TestDb;

vi.mock('@revealui/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/db')>();
  return { ...actual, getClient: () => testDb.drizzle };
});

vi.mock('@revealui/auth/server', () => ({ getSession: vi.fn() }));

vi.mock('@revealui/core/observability/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/core/observability/logger')>();
  return {
    ...actual,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    },
  };
});

const SUBMITTER_ID = 'gap352-user';
const ADMIN_SESSION = { user: { id: 'gap352-admin', role: 'admin' } };

function seedTask(id: string, status: string): Promise<unknown> {
  return testDb.drizzle.insert(taskSubmissions).values({
    id,
    submitterId: SUBMITTER_ID,
    skillName: 'summarize',
    input: {},
    status,
  });
}

function patchRequest(id: string, status: string): NextRequest {
  return new NextRequest(`http://localhost/api/sync/task-submissions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.drizzle.insert(users).values({ id: SUBMITTER_ID, name: 'GAP-352 Submitter' });
});

beforeEach(() => {
  vi.mocked(coreLogger.error).mockClear();
  vi.mocked(authServer.getSession).mockResolvedValue(ADMIN_SESSION as never);
});

describe('GAP-352: admin cancel of a running task must not erase its audit row', () => {
  it('rejects the admin cancel and the completed run keeps its audit row', async () => {
    const taskId = '123e4567-e89b-12d3-a456-426614174000';
    await seedTask(taskId, 'running');

    const response = await PATCH(patchRequest(taskId, 'cancelled'), {
      params: Promise.resolve({ id: taskId }),
    });
    // An admin is NOT exempt from the cancel state machine.
    expect(response.status).toBe(400);

    const [afterPatch] = await testDb.drizzle
      .select({ status: taskSubmissions.status })
      .from(taskSubmissions)
      .where(eq(taskSubmissions.id, taskId));
    expect(afterPatch?.status).toBe('running');

    // The real run now completes through the executor.
    const completed = await completeTask(taskId, {
      success: true,
      output: { summary: 'done' },
      artifacts: [],
      tokensUsed: 42,
      durationMs: 100,
    });
    expect(completed).toBe(true);

    // The audit row for the completed run must exist — this is the record the
    // bug erased.
    const audits = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.taskId, taskId));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe('revmarket:task:completed');
  });

  it.each(['completed', 'failed'])(
    'rejects an admin moving a running task to %s and preserves its audit row',
    async (targetStatus) => {
      const taskId = `gap352-running-to-${targetStatus}`;
      await seedTask(taskId, 'running');

      // Same audit-destroying race as cancel, different verb: an admin PATCH
      // straight to completed/failed would move the row off 'running' and make
      // the executor's completion CAS no-op, skipping the audit write.
      const response = await PATCH(patchRequest(taskId, targetStatus), {
        params: Promise.resolve({ id: taskId }),
      });
      expect(response.status).toBe(400);

      const [afterPatch] = await testDb.drizzle
        .select({ status: taskSubmissions.status })
        .from(taskSubmissions)
        .where(eq(taskSubmissions.id, taskId));
      expect(afterPatch?.status).toBe('running');

      const completed = await completeTask(taskId, {
        success: true,
        output: { summary: 'done' },
        artifacts: [],
        tokensUsed: 42,
        durationMs: 100,
      });
      expect(completed).toBe(true);

      const audits = await testDb.drizzle
        .select()
        .from(auditLog)
        .where(eq(auditLog.taskId, taskId));
      expect(audits).toHaveLength(1);
      expect(audits[0]?.eventType).toBe('revmarket:task:completed');
    },
  );

  it('logs an ERROR (not a warn) when completeTask finds the row already off running', async () => {
    const taskId = 'gap352-race-task';
    // Simulate the race directly: the row was already moved off 'running'.
    await seedTask(taskId, 'cancelled');

    const completed = await completeTask(taskId, {
      success: true,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      durationMs: 0,
    });

    expect(completed).toBe(false);
    expect(coreLogger.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(coreLogger.error).mock.calls[0]?.[1]).toMatchObject({ taskId });

    // A failed CAS writes no audit row.
    const audits = await testDb.drizzle.select().from(auditLog).where(eq(auditLog.taskId, taskId));
    expect(audits).toHaveLength(0);
  });
});
