import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must come before route import
// ---------------------------------------------------------------------------

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(),
}));

// drizzle-orm operators are used directly in the route; stub them to pass-through
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
  secret?: string,
  headerCase: 'X-Cron-Secret' | 'x-cron-secret' = 'X-Cron-Secret',
): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers[headerCase] = secret;
  }
  return new Request('http://localhost/publish-scheduled', {
    method: 'POST',
    headers,
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
// Tests
// ---------------------------------------------------------------------------

describe('POST /publish-scheduled — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns 401 when X-Cron-Secret header is absent', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(undefined));
    expect(res.status).toBe(401);
  });

  it('returns 401 when secret is wrong', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('not-the-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env var is unset', async () => {
    delete process.env.REVEALUI_CRON_SECRET;
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 401 when secret length differs (prevents timing oracle)', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('short'));
    expect(res.status).toBe(401);
  });

  it('accepts lowercase x-cron-secret header', async () => {
    const db = makeDb([]);
    mockedGetClient.mockReturnValue(db as never);
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET, 'x-cron-secret'));
    expect(res.status).toBe(200);
  });
});

describe('POST /publish-scheduled — valid request, no pages due', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns 200 with published:0 when no pages are due', async () => {
    const db = makeDb([]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(0);
    expect(body.ids).toEqual([]);
  });

  it('does not call db.update when no pages are due', async () => {
    const db = makeDb([]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('POST /publish-scheduled — valid request, pages due', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns published count matching the number of due pages', async () => {
    const scheduled = [
      { id: 'page-1', title: 'Welcome' },
      { id: 'page-2', title: 'About' },
    ];
    const db = makeDb(scheduled);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(2);
    expect(body.ids).toEqual(['page-1', 'page-2']);
  });

  it('calls db.update once per due page', async () => {
    const scheduled = [
      { id: 'page-1', title: 'Page 1' },
      { id: 'page-2', title: 'Page 2' },
      { id: 'page-3', title: 'Page 3' },
    ];
    const db = makeDb(scheduled);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(db.update).toHaveBeenCalledTimes(3);
  });

  it('publishes a single page correctly', async () => {
    const db = makeDb([{ id: 'page-solo', title: 'Solo' }]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.published).toBe(1);
    expect(body.ids).toContain('page-solo');
  });
});

describe('POST /publish-scheduled — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns 500 when the DB select throws', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('DB unavailable')),
      }),
      update: vi.fn(),
    };
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });

  it('includes an error message in the 500 body', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('DB unavailable')),
      }),
      update: vi.fn(),
    };
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toContain('Internal error during scheduled publish');
  });

  it('handles non-Error thrown values in body', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue('timeout'),
      }),
      update: vi.fn(),
    };
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

describe('POST /publish-scheduled — update field verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns 500 when getClient throws', async () => {
    mockedGetClient.mockImplementation(() => {
      throw new Error('Client init failed');
    });
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Internal error during scheduled publish');
  });

  it('returns 500 when db.update throws mid-loop', async () => {
    const db = makeDb([
      { id: 'page-1', title: 'Page 1' },
      { id: 'page-2', title: 'Page 2' },
    ]);
    db._updateChain.where.mockRejectedValueOnce(new Error('Update failed'));
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });

  it('sets status to published, publishedAt, and updatedAt on update', async () => {
    const db = makeDb([{ id: 'page-x', title: 'Page X' }]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));

    expect(db._updateChain.set).toHaveBeenCalledOnce();
    const setArgs = db._updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('published');
    expect(setArgs.publishedAt).toBeInstanceOf(Date);
    expect(setArgs.updatedAt).toBeInstanceOf(Date);
  });

  it('handles a large batch of due pages correctly', async () => {
    const scheduled = Array.from({ length: 20 }, (_, i) => ({
      id: `page-${i}`,
      title: `Page ${i}`,
    }));
    const db = makeDb(scheduled);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(20);
    expect(body.ids).toHaveLength(20);
    expect(db.update).toHaveBeenCalledTimes(20);
  });

  it('returns ids in the order pages were processed', async () => {
    const db = makeDb([
      { id: 'page-alpha', title: 'Alpha' },
      { id: 'page-beta', title: 'Beta' },
      { id: 'page-gamma', title: 'Gamma' },
    ]);
    mockedGetClient.mockReturnValue(db as never);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.ids).toEqual(['page-alpha', 'page-beta', 'page-gamma']);
  });
});
