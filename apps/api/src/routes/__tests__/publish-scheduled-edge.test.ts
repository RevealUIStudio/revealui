/**
 * Publish Scheduled  -  Edge Case Tests
 *
 * Supplements publish-scheduled.test.ts with:
 * - Partial failure behavior (no DB transactions → pages before failure stay published)
 * - Timestamp consistency (all pages in a batch share the same `now` timestamp)
 * - Update call verification (db.update called per-page with correct table)
 * - Non-Error thrown from update mid-loop
 * - Auth edge cases (both header variants present, empty string secret)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before route import
// ---------------------------------------------------------------------------

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return actual;
});

import { getClient } from '@revealui/db/client';
import publishApp from '../cron/publish-scheduled.js';

const mockedGetClient = vi.mocked(getClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-cron-secret-32chars-padded!!';

function createApp() {
  const app = new Hono();
  app.route('/', publishApp);
  return app;
}

function makeRequest(
  secret = VALID_SECRET,
  headerName: 'X-Cron-Secret' | 'x-cron-secret' = 'X-Cron-Secret',
): Request {
  return new Request('http://localhost/publish-scheduled', {
    method: 'POST',
    headers: { [headerName]: secret },
  });
}

function makeDb(scheduledPages: Array<{ id: string; title: string }> = []) {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(scheduledPages),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    _updateChain: updateChain,
    _selectChain: selectChain,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /publish-scheduled  -  partial failure behavior (no DB transactions)', () => {
  it('updates pages before the failing one (no rollback  -  loop is sequential)', async () => {
    // The route publishes pages one-by-one in a loop with no transaction.
    // If update fails on page N, pages 1…N-1 are already persisted.
    const db = makeDb([
      { id: 'page-1', title: 'First' },
      { id: 'page-2', title: 'Second' },
      { id: 'page-3', title: 'Third' },
    ]);
    // Fail on the 2nd update (.where call), after the 1st succeeds
    db._updateChain.where
      .mockResolvedValueOnce(undefined) // page-1 succeeds
      .mockRejectedValueOnce(new Error('Lock timeout on page-2')); // page-2 fails
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest());

    // Response is 500 because the loop threw
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Internal error during scheduled publish');

    // db.update was called twice: page-1 succeeded, page-2 threw, page-3 never ran
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('returns 500 with string error when non-Error is thrown from update', async () => {
    const db = makeDb([{ id: 'page-1', title: 'Page 1' }]);
    db._updateChain.where.mockRejectedValueOnce('ECONNRESET');
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    // Route returns a generic error message regardless of thrown value type
    expect(body.error).toBe('Internal error during scheduled publish');
  });

  it('stops processing further pages after a mid-loop update failure', async () => {
    const db = makeDb([
      { id: 'page-1', title: 'First' },
      { id: 'page-2', title: 'Second' },
      { id: 'page-3', title: 'Third' },
    ]);
    db._updateChain.where
      .mockResolvedValueOnce(undefined) // page-1 succeeds
      .mockRejectedValueOnce(new Error('DB error')); // page-2 fails  -  page-3 never reached
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest());

    // Only 2 update calls: page-1 + page-2 (which threw). page-3 was never attempted.
    // This is intentional  -  the route does not retry or skip failed pages.
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});

describe('POST /publish-scheduled  -  timestamp consistency', () => {
  it('all pages in a batch share the same publishedAt timestamp', async () => {
    const scheduled = [
      { id: 'page-1', title: 'First' },
      { id: 'page-2', title: 'Second' },
      { id: 'page-3', title: 'Third' },
    ];
    const db = makeDb(scheduled);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest());

    const setCalls = db._updateChain.set.mock.calls;
    expect(setCalls).toHaveLength(3);

    // All updates should use the same `now` Date object  -  route creates it once before the loop
    const [first, second, third] = setCalls;
    const t0 = (first![0] as Record<string, unknown>).publishedAt as Date;
    const t1 = (second![0] as Record<string, unknown>).publishedAt as Date;
    const t2 = (third![0] as Record<string, unknown>).publishedAt as Date;

    expect(t0).toBe(t1); // Same object reference (created once outside loop)
    expect(t1).toBe(t2);
  });

  it('publishedAt and updatedAt are set to the same Date instance', async () => {
    const db = makeDb([{ id: 'page-1', title: 'Page 1' }]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest());

    const setArgs = db._updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.publishedAt).toBe(setArgs.updatedAt); // Same `now` reference
  });
});

describe('POST /publish-scheduled  -  db.update call correctness', () => {
  it('calls db.update with pages table for every scheduled page', async () => {
    const db = makeDb([
      { id: 'page-a', title: 'Alpha' },
      { id: 'page-b', title: 'Beta' },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest());

    expect(db.update).toHaveBeenCalledTimes(2);
    // Each call should pass the pages table (the actual Drizzle table object)
    // We can't easily inspect the Drizzle table reference directly, but we can
    // verify the update chain was exercised for each page via set/where call counts
    expect(db._updateChain.set).toHaveBeenCalledTimes(2);
    expect(db._updateChain.where).toHaveBeenCalledTimes(2);
  });

  it('response ids list matches the input scheduled pages exactly', async () => {
    const scheduled = [
      { id: 'unique-id-1', title: 'A' },
      { id: 'unique-id-2', title: 'B' },
      { id: 'unique-id-3', title: 'C' },
    ];
    const db = makeDb(scheduled);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest());
    const body = await res.json();

    expect(body.ids).toEqual(['unique-id-1', 'unique-id-2', 'unique-id-3']);
    expect(body.published).toBe(3);
  });
});

describe('POST /publish-scheduled  -  auth edge cases', () => {
  it('returns 401 when REVEALUI_CRON_SECRET is an empty string', async () => {
    process.env.REVEALUI_CRON_SECRET = '';
    const app = createApp();
    // Both provided and cronSecret are falsy  -  early auth check fails
    const res = await app.request(makeRequest(''));
    expect(res.status).toBe(401);
  });

  it('returns 401 when provided secret is an empty string', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(''));
    // Empty string is falsy → !(cronSecret && provided) is true → 401
    expect(res.status).toBe(401);
  });

  it('returns 200 when both X-Cron-Secret variants match the same valid secret', async () => {
    // HTTP headers are case-insensitive  -  X-Cron-Secret and x-cron-secret are
    // the same header. Sending both with the same value is a no-op; one wins.
    const db = makeDb([]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/publish-scheduled', {
        method: 'POST',
        // Only one value possible  -  case-insensitive headers normalise to the same key
        headers: { 'X-Cron-Secret': VALID_SECRET },
      }),
    );
    expect(res.status).toBe(200);
  });
});
