import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../client/index.js';
import * as schema from '../schema/index.js';
import {
  assertOwnerSlotAvailable,
  countOwners,
  OWNER_SOFT_CAP,
  OwnerSlotError,
  withUserDomainCleanupAdmission,
} from './users.js';

function mockDbWithOwnerCount(total: number) {
  const where = vi.fn().mockResolvedValue([{ total }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as never;
}

describe('users queries  -  owner soft cap', () => {
  it('countOwners returns 0 when no owners exist', async () => {
    await expect(countOwners(mockDbWithOwnerCount(0))).resolves.toBe(0);
  });

  it('countOwners returns the total from the aggregate row', async () => {
    await expect(countOwners(mockDbWithOwnerCount(2))).resolves.toBe(2);
  });

  it('assertOwnerSlotAvailable passes when below the cap', async () => {
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(0))).resolves.toBeUndefined();
    await expect(
      assertOwnerSlotAvailable(mockDbWithOwnerCount(OWNER_SOFT_CAP - 1)),
    ).resolves.toBeUndefined();
  });

  it('assertOwnerSlotAvailable throws OwnerSlotError when cap is reached', async () => {
    const db = mockDbWithOwnerCount(OWNER_SOFT_CAP);
    await expect(assertOwnerSlotAvailable(db)).rejects.toBeInstanceOf(OwnerSlotError);
  });

  it('OwnerSlotError exposes current count and max for API surfacing', async () => {
    try {
      await assertOwnerSlotAvailable(mockDbWithOwnerCount(OWNER_SOFT_CAP));
      expect.fail('expected OwnerSlotError');
    } catch (err) {
      expect(err).toBeInstanceOf(OwnerSlotError);
      const e = err as OwnerSlotError;
      expect(e.code).toBe('OWNER_SLOT_EXHAUSTED');
      expect(e.currentCount).toBe(OWNER_SOFT_CAP);
      expect(e.max).toBe(OWNER_SOFT_CAP);
    }
  });

  it('honors a custom max when provided', async () => {
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(1), 1)).rejects.toBeInstanceOf(
      OwnerSlotError,
    );
    await expect(assertOwnerSlotAvailable(mockDbWithOwnerCount(0), 1)).resolves.toBeUndefined();
  });
});

describe('users queries - domain cleanup admission execution', () => {
  function queryClient(run: (text: string, values: unknown[]) => Promise<void>) {
    const statements: Array<{ text: string; values: unknown[] }> = [];
    const query = vi.fn(async (config: { text: string }, values: unknown[] = []) => {
      statements.push({ text: config.text, values });
      await run(config.text, values);
      return { rows: [], rowCount: 0 };
    });
    // A synthetic pg query adapter exercises real Drizzle dispatch and transaction
    // ordering without connecting to PostgreSQL or claiming native lock contention.
    const client = { query } as unknown as PoolClient;
    const db = drizzle({ client, schema }) as Database;
    return { db, statements };
  }

  it('executes and awaits parameterized lock SQL before checking aliases or running erasure', async () => {
    let started!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { db, statements } = queryClient(async (text) => {
      if (text.includes('pg_advisory_xact_lock')) {
        started();
        await released;
      }
    });
    const userId = "synthetic-owner'; --";
    const erase = vi.fn(async () => 'erased');
    const pending = withUserDomainCleanupAdmission(db, userId, erase);
    try {
      await Promise.race([
        ready,
        pending.then(() => {
          throw new Error('Admission completed without executing lock SQL');
        }),
      ]);
      expect(erase).not.toHaveBeenCalled();
      expect(statements).toHaveLength(2);
      expect(statements[1]?.text).toMatch(/^select pg_advisory_xact_lock/i);
      expect(statements[1]?.text).not.toContain(userId);
      expect(statements[1]?.values).toEqual(['consultation-domain-owner:', userId]);
      release();
      await expect(pending).resolves.toBe('erased');
      expect(erase).toHaveBeenCalledTimes(1);
      expect(statements[2]?.text).toContain('from "sites"');
      expect(statements[3]?.text).toBe('commit');
    } finally {
      release();
      await pending.catch(() => undefined);
    }
  });

  it('rolls back and prevents erasure when executing lock SQL fails', async () => {
    const failure = new Error('Synthetic lock acquisition failure');
    const { db, statements } = queryClient(async (text) => {
      if (text.includes('pg_advisory_xact_lock')) throw failure;
    });
    const erase = vi.fn(async () => 'must not run');
    await expect(
      withUserDomainCleanupAdmission(db, 'synthetic-owner', erase),
    ).rejects.toMatchObject({
      cause: failure,
    });
    expect(erase).not.toHaveBeenCalled();
    expect(statements.map((statement) => statement.text === 'rollback')).toEqual([
      false,
      false,
      true,
    ]);
    expect(statements.some((statement) => statement.text.includes('from "sites"'))).toBe(false);
  });
});
