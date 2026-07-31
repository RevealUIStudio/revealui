import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetJtiDenylistForTest,
  getJtiRevocationEpoch,
  isJtiRevoked,
  recordJtiRevocations,
} from '../license-jti-denylist.js';

function createMockDb(opts: { selectRows?: Array<{ jti: string }>; insertThrows?: boolean } = {}) {
  const limit = vi.fn().mockResolvedValue(opts.selectRows ?? []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = opts.insertThrows
    ? vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockRejectedValue(new Error('db down')),
        }),
      })
    : vi.fn().mockReturnValue({ values });

  return { select, insert, _limit: limit, _values: values, _onConflict: onConflictDoNothing };
}

describe('license jti denylist (GAP-260 P4-5)', () => {
  beforeEach(() => {
    __resetJtiDenylistForTest();
  });

  afterEach(() => {
    __resetJtiDenylistForTest();
  });

  it('isJtiRevoked returns false for missing jti (fail-open)', async () => {
    const db = createMockDb();
    expect(await isJtiRevoked(db as never, undefined)).toBe(false);
    expect(await isJtiRevoked(db as never, '')).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('isJtiRevoked returns false for unknown jti (fail-open)', async () => {
    const db = createMockDb({ selectRows: [] });
    expect(await isJtiRevoked(db as never, 'jti-unknown')).toBe(false);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it('isJtiRevoked returns true and sticks after DB hit', async () => {
    const db = createMockDb({ selectRows: [{ jti: 'jti-revoked' }] });
    expect(await isJtiRevoked(db as never, 'jti-revoked')).toBe(true);
    // Second call must not re-query (sticky)
    expect(await isJtiRevoked(db as never, 'jti-revoked')).toBe(true);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it('isJtiRevoked fail-opens on DB error for non-sticky jtis', async () => {
    const db = createMockDb();
    db._limit.mockRejectedValueOnce(new Error('connection lost'));
    expect(await isJtiRevoked(db as never, 'jti-x')).toBe(false);
  });

  it('recordJtiRevocations sets sticky and bumps epoch', async () => {
    const db = createMockDb();
    const before = getJtiRevocationEpoch();
    const n = await recordJtiRevocations(db as never, [
      { jti: 'jti-a', reason: 'test' },
      { jti: 'jti-b', customerId: 'cus_1' },
    ]);
    expect(n).toBe(2);
    expect(getJtiRevocationEpoch()).toBe(before + 1);
    // Sticky without DB select
    const db2 = createMockDb({ selectRows: [] });
    expect(await isJtiRevoked(db2 as never, 'jti-a')).toBe(true);
    expect(db2.select).not.toHaveBeenCalled();
  });

  it('recordJtiRevocations ignores empty jtis', async () => {
    const db = createMockDb();
    const n = await recordJtiRevocations(db as never, [{ jti: '  ' }, { jti: '' }]);
    expect(n).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
