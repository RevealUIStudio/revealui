import type { Database } from '@revealui/db/client';
import { describe, expect, it, vi } from 'vitest';
import { admitAgentTask } from '../agent-task-quota.js';

function quotaDb(input: { reserved: boolean; count: number; credit: boolean }): Database {
  const returning = vi.fn(async () => (input.reserved ? [{ count: 1 }] : []));
  const onConflictDoUpdate = vi.fn(() => ({ returning, catch: vi.fn(async () => undefined) }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  const limit = vi.fn(async () => [{ count: input.count }]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  const creditReturning = vi.fn(async () => (input.credit ? [{ balance: 0 }] : []));
  const updateWhere = vi.fn(() => ({ returning: creditReturning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return { insert, select, update } as unknown as Database;
}

describe('admitAgentTask', () => {
  it('refuses when the monthly plan slot is already at the quota', async () => {
    const db = quotaDb({ reserved: false, count: 10, credit: false });
    const result = await admitAgentTask(db, { userId: 'user-1', quota: 10 });
    expect(result).toMatchObject({
      admitted: false,
      reason: 'quota',
      used: 10,
      quota: 10,
    });
    if (!result.admitted && result.reason === 'quota') {
      expect(result.resetAt).toContain('T00:00:00.000Z');
    }
  });

  it('admits when the conditional upsert reserves a slot', async () => {
    const db = quotaDb({ reserved: true, count: 0, credit: false });
    const result = await admitAgentTask(db, { userId: 'user-1', quota: 10 });
    expect(result).toEqual({ admitted: true });
  });
});
