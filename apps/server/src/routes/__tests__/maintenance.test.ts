import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before route import
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

describe('POST /cleanup-orphans  -  auth', () => {
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
    // Must NOT call cleanup  -  auth must fail before any DB work
    expect(mockedCleanup).not.toHaveBeenCalled();
  });

  it('does not expose the secret in the 403 body', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('wrong'));
    const bodyText = await res.text();
    expect(bodyText).not.toContain(VALID_SECRET);
  });
});

describe('POST /cleanup-orphans  -  valid request', () => {
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

describe('POST /cleanup-orphans  -  error handling', () => {
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

  it('includes sanitized error message in the 500 body', async () => {
    mockedCleanup.mockRejectedValue(new Error('Supabase connection refused'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.error).toBe('Cross-DB orphan cleanup failed');
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

describe('POST /cleanup-orphans  -  logging', () => {
  const mockLoggerInfo = vi.fn();
  const mockLoggerError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
    // Override the logger mock with local spies for this suite
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();
  });

  it('returns 500 when getRestClient throws', async () => {
    mockedGetRestClient.mockImplementation(() => {
      throw new Error('REST client unavailable');
    });
    mockedCleanup.mockResolvedValue(defaultResult);
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Cross-DB orphan cleanup failed');
  });

  it('handles large deletedSiteIds array correctly', async () => {
    const siteIds = Array.from({ length: 50 }, (_, i) => `site-${i}`);
    mockedCleanup.mockResolvedValue({ ...defaultResult, deletedSiteIds: siteIds });
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedSiteIds).toHaveLength(50);
  });

  it('cleanup is not called when auth fails', async () => {
    const app = createApp();
    await app.request(makeRequest(undefined));
    expect(mockedCleanup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Vector client failure
// ---------------------------------------------------------------------------

describe('POST /cleanup-orphans  -  vector client failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
  });

  it('returns 500 when getVectorClient throws', async () => {
    mockedGetVectorClient.mockImplementation(() => {
      throw new Error('Vector client unavailable');
    });
    mockedCleanup.mockResolvedValue(defaultResult);

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Cross-DB orphan cleanup failed');
  });

  it('returns 500 when both DB clients throw', async () => {
    mockedGetRestClient.mockImplementation(() => {
      throw new Error('REST unavailable');
    });
    mockedGetVectorClient.mockImplementation(() => {
      throw new Error('Vector unavailable');
    });

    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    // First error thrown (REST) is the one caught
    const body = await res.json();
    expect(body.error).toBe('Cross-DB orphan cleanup failed');
  });
});

// ---------------------------------------------------------------------------
// Logger verification
// ---------------------------------------------------------------------------

describe('POST /cleanup-orphans  -  logger verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
  });

  it('logs success info after cleanup completes', async () => {
    mockedCleanup.mockResolvedValue(defaultResult);
    const { logger } = await import('@revealui/core/observability/logger');

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));

    expect(logger.info).toHaveBeenCalledWith(
      'Cross-DB orphan cleanup completed',
      expect.objectContaining({
        agentMemoriesDeleted: 3,
        ragDocumentsDeleted: 1,
        ragChunksDeleted: 12,
        deletedSiteIds: 2,
        dryRun: false,
      }),
    );
  });

  it('logs error when cleanup throws', async () => {
    const error = new Error('Supabase timeout');
    mockedCleanup.mockRejectedValue(error);
    const { logger } = await import('@revealui/core/observability/logger');

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));

    expect(logger.error).toHaveBeenCalledWith('Cross-DB orphan cleanup failed', error);
  });

  it('logs deletedSiteIds count (not the full array) on success', async () => {
    const siteIds = Array.from({ length: 100 }, (_, i) => `site-${i}`);
    mockedCleanup.mockResolvedValue({ ...defaultResult, deletedSiteIds: siteIds });
    const { logger } = await import('@revealui/core/observability/logger');

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));

    expect(logger.info).toHaveBeenCalledWith(
      'Cross-DB orphan cleanup completed',
      expect.objectContaining({ deletedSiteIds: 100 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Method and path edge cases
// ---------------------------------------------------------------------------

describe('POST /cleanup-orphans  -  method and path edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockedGetRestClient.mockReturnValue({} as never);
    mockedGetVectorClient.mockReturnValue({} as never);
    mockedCleanup.mockResolvedValue(defaultResult);
  });

  it('rejects GET /cleanup-orphans', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/cleanup-orphans', { method: 'GET' }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 404 for POST /unknown-path', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/unknown-path', {
        method: 'POST',
        headers: { 'X-Cron-Secret': VALID_SECRET },
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns application/json Content-Type on success', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('returns 403 when REVEALUI_CRON_SECRET is empty string', async () => {
    process.env.REVEALUI_CRON_SECRET = '';
    const app = createApp();
    const res = await app.request(makeRequest(''));
    expect(res.status).toBe(403);
  });
});
