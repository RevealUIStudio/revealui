/**
 * Owned clients resolve callback transactions through the maintained transport.
 * Unowned clients must provide their own callback transaction API before work runs.
 * Managed Neon transport and lease/savepoint behavior are covered by client tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { type Database, withTransaction } from './client/index.js';

describe('withTransaction injected client admission', () => {
  it('rejects an unowned client without a transaction API before invoking work', async () => {
    const db = {} as Database;
    const work = vi.fn(async () => 'must not run');
    await expect(withTransaction(db, work)).rejects.toThrow('Transaction not supported');
    expect(work).not.toHaveBeenCalled();
  });

  it('requires a callable transaction API before invoking work', async () => {
    const db = { transaction: true } as unknown as Database;
    const work = vi.fn(async () => 'must not run');
    await expect(withTransaction(db, work)).rejects.toThrow('no callback transaction API');
    expect(work).not.toHaveBeenCalled();
  });

  it('directs unsupported injected clients to the maintained factory or a capable client', async () => {
    const db = {} as Database;
    await expect(withTransaction(db, async () => 'unreachable')).rejects.toThrow(
      'Use a client from the maintained database factory or inject a transaction-capable client',
    );
  });

  it('returns the injected transaction result and passes its exact context to work', async () => {
    const context = { isTransaction: true } as unknown as Database;
    const result = { completed: true };
    const work = vi.fn(async (tx: Database) => {
      expect(tx).toBe(context);
      return result;
    });
    const transaction = vi.fn(async (callback: (tx: Database) => Promise<typeof result>) =>
      callback(context),
    );
    const db = { transaction } as unknown as Database;
    expect(await withTransaction(db, work)).toBe(result);
    expect(transaction).toHaveBeenCalledExactlyOnceWith(work);
    expect(work).toHaveBeenCalledExactlyOnceWith(context);
  });

  it('propagates transaction admission failure without running work or retrying', async () => {
    const failure = new Error('Synthetic transaction admission failure');
    const transaction = vi.fn(async () => {
      throw failure;
    });
    const db = { transaction } as unknown as Database;
    const work = vi.fn(async () => 'must not run');
    await expect(withTransaction(db, work)).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(work).not.toHaveBeenCalled();
  });

  it('propagates callback failure through the injected transaction owner without retrying', async () => {
    const failure = new Error('Synthetic transaction callback failure');
    const context = {} as Database;
    const transaction = vi.fn(async (callback: (tx: Database) => Promise<never>) =>
      callback(context),
    );
    const db = { transaction } as unknown as Database;
    const work = vi.fn(async () => {
      throw failure;
    });
    await expect(withTransaction(db, work)).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledExactlyOnceWith(context);
  });
});
