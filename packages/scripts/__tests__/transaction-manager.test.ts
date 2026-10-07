import type { PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseConnection } from '../database/connection.js';

vi.mock('../index.js', () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { withTransaction } from '../database/transaction-manager.js';

function fixture(failure?: string) {
  const query = vi.fn(async (sql: string) => {
    if (sql === failure || (failure === 'BEGIN' && sql.startsWith('BEGIN')))
      throw new Error(`injected ${failure}`);
    return { rows: [], rowCount: 0, command: sql.split(' ')[0] };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const poolQuery = vi.fn();
  const connection = {
    connect: vi.fn(async () => client),
    query: poolQuery,
  } as unknown as DatabaseConnection;
  return { connection, client, query, release, poolQuery };
}
afterEach(() => vi.useRealTimers());

describe('managed leased-client transactions', () => {
  it('uses one lease and releases once after confirmed commit', async () => {
    const f = fixture();
    expect(
      await withTransaction(f.connection, async ({ client }) => {
        await client.query('INSERT');
        return 'done';
      }),
    ).toBe('done');
    expect(f.poolQuery).not.toHaveBeenCalled();
    expect(f.connection.connect).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('preserves callback error and destroys client on failed rollback', async () => {
    const f = fixture('ROLLBACK');
    const error = new Error('original row failure');
    await expect(
      withTransaction(f.connection, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
  });

  it('does not roll back or release until a timed-out callback settles', async () => {
    vi.useFakeTimers();
    const f = fixture();
    let finish!: () => void;
    const barrier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const transaction = withTransaction(
      f.connection,
      async ({ client }) => {
        entered();
        await barrier;
        await client.query('LATE WRITE');
      },
      { timeout: 10 },
    );
    const settled = transaction.then(
      () => undefined,
      (error: unknown) => error,
    );
    await started;
    await vi.advanceTimersByTimeAsync(11);
    const prematureRelease = f.release.mock.calls.length;
    const prematureRollback = f.query.mock.calls.some(([sql]) => sql === 'ROLLBACK');
    finish();
    const error = await settled;
    expect(prematureRelease).toBe(0);
    expect(prematureRollback).toBe(false);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('timed out');
    expect(f.query.mock.calls.slice(-2).map(([sql]) => sql)).toEqual(['LATE WRITE', 'ROLLBACK']);
    expect(f.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('rolls back cancellation after callback work settles', async () => {
    const f = fixture();
    const controller = new AbortController();
    await expect(
      withTransaction(
        f.connection,
        async ({ client }) => {
          controller.abort(new Error('cancelled'));
          await client.query('IN FLIGHT');
        },
        { signal: controller.signal },
      ),
    ).rejects.toThrow('cancelled');
    expect(f.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('destroys a client when BEGIN fails', async () => {
    const f = fixture('BEGIN');
    await expect(withTransaction(f.connection, async () => undefined)).rejects.toThrow(
      'injected BEGIN',
    );
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(false);
  });

  it('reports uncertain COMMIT without claiming rollback or retrying', async () => {
    const f = fixture('COMMIT');
    await expect(withTransaction(f.connection, async () => undefined)).rejects.toThrow(
      'commit outcome is unknown',
    );
    expect(f.query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(f.query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(false);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('rejects an acknowledged rollback instead of reporting a committed result', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql: string) => ({
      rows: [],
      rowCount: 0,
      command: sql === 'COMMIT' ? 'ROLLBACK' : sql.split(' ')[0],
    }));
    await expect(withTransaction(f.connection, async () => 'uncommitted')).rejects.toThrow(
      'rolled back',
    );
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
    expect(f.query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(f.query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(false);
  });
});
