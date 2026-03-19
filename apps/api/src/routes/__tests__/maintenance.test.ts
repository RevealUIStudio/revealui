import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must come before route import
// ---------------------------------------------------------------------------

vi.mock('@revealui/db', () => ({
  getRestClient: vi.fn(),
  getVectorClient: vi.fn(),
}));

vi.mock('@revealui/db/cleanup', () => ({
  cleanupOrphanedVectorData: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { getRestClient, getVectorClient } from '@revealui/db';
import { cleanupOrphanedVectorData } from '@revealui/db/cleanup';
import maintenanceApp from '../maintenance.js';

const mockedCleanup = vi.mocked(cleanupOrphanedVectorData);
const mockedGetRestClient = vi.mocked(getRestClient);
const mockedGetVectorClient = vi.mocked(getVectorClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-cron-secret-32chars-padded!!';

function createApp() {
  const app = new Hono();
  app.route('/', maintenanceApp);
  return app;
}

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret !== undefined) {
    headers['X-Cron-Secret'] = secret;
  }
  return new Request('http://localhost/cleanup-orphans', {
    method: 'POST',
    headers,
  });
}

const defaultResult = {
  agentMemoriesDeleted: 3,
  ragDocumentsDeleted: 1,
  ragChunksDeleted: 12,
  deletedSiteIds: ['site-a', 'site-b'],
  dryRun: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /cleanup-orphans — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
    mockedCleanup.mockResolvedValue(defaultResult);
  });

  it('returns 403 when X-Cron-Secret header is absent', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(undefined));
    expect(res.status).toBe(403);
  });

  it('returns 403 when secret is wrong', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('wrong-secret'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when REVEALUI_CRON_SECRET env var is unset', async () => {
    delete process.env.REVEALUI_CRON_SECRET;
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(403);
  });

  it('returns 403 when secret length differs (prevents timing oracle)', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('short'));
    expect(res.status).toBe(403);
    // Must NOT call cleanup — auth must fail before any DB work
    expect(mockedCleanup).not.toHaveBeenCalled();
  });

  it('does not expose the secret in the 403 body', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('wrong'));
    const bodyText = await res.text();
    expect(bodyText).not.toContain(VALID_SECRET);
  });
});

describe('POST /cleanup-orphans — valid request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
    mockedCleanup.mockResolvedValue(defaultResult);
  });

  it('returns 200 with cleanup results', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agentMemoriesDeleted).toBe(3);
    expect(body.ragDocumentsDeleted).toBe(1);
    expect(body.ragChunksDeleted).toBe(12);
    expect(body.deletedSiteIds).toEqual(['site-a', 'site-b']);
    expect(body.dryRun).toBe(false);
  });

  it('calls cleanupOrphanedVectorData with rest and vector clients', async () => {
    const fakeRest = { type: 'rest' };
    const fakeVector = { type: 'vector' };
    mockedGetRestClient.mockReturnValue(fakeRest as never);
    mockedGetVectorClient.mockReturnValue(fakeVector as never);

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));

    expect(mockedCleanup).toHaveBeenCalledOnce();
    expect(mockedCleanup).toHaveBeenCalledWith(fakeRest, fakeVector);
  });

  it('returns dryRun:true when cleanup reports a dry run', async () => {
    mockedCleanup.mockResolvedValue({ ...defaultResult, dryRun: true });
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.dryRun).toBe(true);
  });

  it('returns zero counts when nothing was cleaned up', async () => {
    mockedCleanup.mockResolvedValue({
      agentMemoriesDeleted: 0,
      ragDocumentsDeleted: 0,
      ragChunksDeleted: 0,
      deletedSiteIds: [],
      dryRun: false,
    });
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agentMemoriesDeleted).toBe(0);
    expect(body.deletedSiteIds).toHaveLength(0);
  });
});

describe('POST /cleanup-orphans — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
  });

  it('returns 500 when cleanup throws', async () => {
    mockedCleanup.mockRejectedValue(new Error('Supabase connection refused'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });

  it('includes the error message in the 500 body', async () => {
    mockedCleanup.mockRejectedValue(new Error('Supabase connection refused'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.error).toContain('Supabase connection refused');
  });

  it('handles non-Error thrown values gracefully', async () => {
    mockedCleanup.mockRejectedValue('timeout');
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
