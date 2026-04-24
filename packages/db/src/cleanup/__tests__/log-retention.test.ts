import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal chainable mock db. We intercept the terminal method (the one the
// SUT awaits) and return fixed rows. The Drizzle methods used by
// cleanupOldLogs are: .select().from().where() for dryRun; .delete().where().returning()
// for the actual delete.
interface MockRow {
  id: string;
}

function mockDb(rowsByTable: { appLogs?: MockRow[]; errorEvents?: MockRow[] }) {
  let currentTable: 'appLogs' | 'errorEvents' | null = null;

  const selectChain = {
    from: vi.fn((tbl: { _symbol?: string }) => {
      currentTable = tbl._symbol === 'appLogs' ? 'appLogs' : 'errorEvents';
      return selectChain;
    }),
    where: vi.fn(async () => {
      return currentTable === 'appLogs'
        ? (rowsByTable.appLogs ?? [])
        : (rowsByTable.errorEvents ?? []);
    }),
  };

  const deleteChain = {
    where: vi.fn(() => deleteChain),
    returning: vi.fn(async () => {
      return currentTable === 'appLogs'
        ? (rowsByTable.appLogs ?? [])
        : (rowsByTable.errorEvents ?? []);
    }),
  };

  return {
    select: vi.fn(() => selectChain),
    delete: vi.fn((tbl: { _symbol?: string }) => {
      currentTable = tbl._symbol === 'appLogs' ? 'appLogs' : 'errorEvents';
      return deleteChain;
    }),
    _internals: { selectChain, deleteChain },
  };
}

// The SUT imports from '../schema/app-logs.js' and '../schema/error-events.js'.
// We stub just enough of those modules for lt(appLogs.timestamp, cutoff) to
// resolve without touching the real Drizzle internals.
vi.mock('../../schema/app-logs.js', () => ({
  appLogs: {
    _symbol: 'appLogs',
    timestamp: { _col: 'appLogs.timestamp' },
    id: { _col: 'appLogs.id' },
  },
}));

vi.mock('../../schema/error-events.js', () => ({
  errorEvents: {
    _symbol: 'errorEvents',
    timestamp: { _col: 'errorEvents.timestamp' },
    id: { _col: 'errorEvents.id' },
  },
}));

// drizzle-orm's `lt` is pure — returns an opaque sql fragment. Stub ONLY it
// (importOriginal preserves `relations`, `eq`, etc. that the schema layer
// needs at import time) so the where() predicates become inspectable but
// Drizzle's other machinery keeps working.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    lt: vi.fn((col: unknown, val: unknown) => ({ _op: 'lt', col, val })),
  };
});

import { cleanupOldLogs } from '../log-retention.js';

describe('cleanupOldLogs', () => {
  const ORIGINAL_ENV = process.env.REVEALUI_LOG_RETENTION_DAYS;

  beforeEach(() => {
    process.env.REVEALUI_LOG_RETENTION_DAYS = undefined;
    delete process.env.REVEALUI_LOG_RETENTION_DAYS;
  });

  afterEach(() => {
    if (ORIGINAL_ENV !== undefined) {
      process.env.REVEALUI_LOG_RETENTION_DAYS = ORIGINAL_ENV;
    } else {
      delete process.env.REVEALUI_LOG_RETENTION_DAYS;
    }
  });

  it('deletes old rows from both tables by default', async () => {
    const db = mockDb({
      appLogs: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
      errorEvents: [{ id: 'e1' }],
    });

    const result = await cleanupOldLogs({ db: db as never });

    expect(result.appLogs).toBe(3);
    expect(result.errorEvents).toBe(1);
    expect(result.dryRun).toBe(false);
    expect(result.retentionDays).toBe(90);
    expect(result.cutoff).toBeInstanceOf(Date);
    // delete was called twice — once per table
    expect(db.delete).toHaveBeenCalledTimes(2);
  });

  it('counts (does not delete) in dry-run mode', async () => {
    const db = mockDb({
      appLogs: [{ id: 'a1' }, { id: 'a2' }],
      errorEvents: [],
    });

    const result = await cleanupOldLogs({ db: db as never, dryRun: true });

    expect(result.appLogs).toBe(2);
    expect(result.errorEvents).toBe(0);
    expect(result.dryRun).toBe(true);
    // delete MUST NOT be called in dry-run
    expect(db.delete).not.toHaveBeenCalled();
    // select was called once per table for the dryRun count
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('respects the `tables` option — skips unlisted tables', async () => {
    const db = mockDb({
      appLogs: [{ id: 'a1' }, { id: 'a2' }],
      errorEvents: [{ id: 'e1' }],
    });

    const result = await cleanupOldLogs({ db: db as never, tables: ['appLogs'] });

    expect(result.appLogs).toBe(2);
    // errorEvents was not listed — must stay at 0 and never be queried
    expect(result.errorEvents).toBe(0);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('respects explicit retentionDays override', async () => {
    const db = mockDb({ appLogs: [], errorEvents: [] });

    const result = await cleanupOldLogs({ db: db as never, retentionDays: 7 });

    expect(result.retentionDays).toBe(7);
    const expectedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // allow 2s clock skew for test runtime
    expect(Math.abs(result.cutoff.getTime() - expectedCutoff)).toBeLessThan(2000);
  });

  it('reads REVEALUI_LOG_RETENTION_DAYS env var when no override is passed', async () => {
    process.env.REVEALUI_LOG_RETENTION_DAYS = '30';
    const db = mockDb({ appLogs: [], errorEvents: [] });

    const result = await cleanupOldLogs({ db: db as never });

    expect(result.retentionDays).toBe(30);
  });

  it('falls back to 90 days when env var is invalid', async () => {
    process.env.REVEALUI_LOG_RETENTION_DAYS = 'not-a-number';
    const db = mockDb({ appLogs: [], errorEvents: [] });

    const result = await cleanupOldLogs({ db: db as never });

    expect(result.retentionDays).toBe(90);
  });

  it('falls back to 90 days when env var is zero or negative', async () => {
    const db = mockDb({ appLogs: [], errorEvents: [] });

    process.env.REVEALUI_LOG_RETENTION_DAYS = '0';
    expect((await cleanupOldLogs({ db: db as never })).retentionDays).toBe(90);

    process.env.REVEALUI_LOG_RETENTION_DAYS = '-5';
    expect((await cleanupOldLogs({ db: db as never })).retentionDays).toBe(90);
  });

  it('rejects non-integer explicit retentionDays override', async () => {
    const db = mockDb({ appLogs: [], errorEvents: [] });

    await expect(cleanupOldLogs({ db: db as never, retentionDays: 1.5 })).rejects.toThrow(
      /Invalid retentionDays override: 1.5/,
    );
  });

  it('rejects zero or negative explicit retentionDays override', async () => {
    const db = mockDb({ appLogs: [], errorEvents: [] });

    await expect(cleanupOldLogs({ db: db as never, retentionDays: 0 })).rejects.toThrow(
      /Invalid retentionDays override: 0/,
    );
    await expect(cleanupOldLogs({ db: db as never, retentionDays: -3 })).rejects.toThrow(
      /Invalid retentionDays override: -3/,
    );
  });
});
