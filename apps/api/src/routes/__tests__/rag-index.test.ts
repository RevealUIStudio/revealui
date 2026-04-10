import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/db/client', () => ({
  getVectorClient: vi.fn(),
  getRestClient: vi.fn(),
}));

vi.mock('@revealui/db/schema/rag', () => ({
  ragDocuments: {
    workspaceId: 'workspaceId',
    status: 'status',
    indexedAt: 'indexedAt',
  },
}));

// Mock dynamic AI imports — default to unavailable
vi.mock('@revealui/ai/embeddings', () => {
  throw new Error('not available');
});
vi.mock('@revealui/ai/ingestion', () => {
  throw new Error('not available');
});

import { getVectorClient } from '@revealui/db/client';
import ragApp from '../rag-index.js';

const mockedGetVectorClient = vi.mocked(getVectorClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper
function createApp(dbMock?: any) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { db: any; tenant: any; user: any } }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'test-user', role: 'admin' });
    if (dbMock) c.set('db', dbMock);
    await next();
  });
  app.route('/rag', ragApp);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('rag-index routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /rag/workspaces/:workspaceId/index/:collection', () => {
    it('rejects invalid collection names', async () => {
      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/invalid collection!', {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('Invalid collection name');
    });

    it('rejects collection names with special characters', async () => {
      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/my.collection', {
        method: 'POST',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('Invalid collection name');
    });

    it('accepts valid collection names with alphanumeric, dashes, underscores', async () => {
      // Will fail at admin fetch since we have no mock for global fetch,
      // but the collection name validation should pass
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

      try {
        const app = createApp();

        const res = await app.request('/rag/workspaces/ws-1/index/valid-collection_1', {
          method: 'POST',
        });

        // Should get past validation — will fail at admin fetch (502)
        expect(res.status).toBe(502);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns 502 when admin responds with a non-ok HTTP status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({}),
        }),
      );

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', {
        method: 'POST',
      });

      expect(res.status).toBe(502);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Admin fetch failed: HTTP 404');
    });

    it('returns 502 with admin HTTP 500 status in error message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({}),
        }),
      );

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/articles', {
        method: 'POST',
      });

      expect(res.status).toBe(502);
      const body = await parseBody(res);
      expect(body.error).toBe('Admin fetch failed: HTTP 500');
    });

    it('returns 502 when admin fetch throws a network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', {
        method: 'POST',
      });

      expect(res.status).toBe(502);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Admin fetch error: upstream service unavailable');
    });

    it('returns 502 when admin fetch throws a non-Error object', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('timeout'));

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', {
        method: 'POST',
      });

      expect(res.status).toBe(502);
      const body = await parseBody(res);
      expect(body.error).toBe('Admin fetch error: upstream service unavailable');
    });

    it('returns 403 when AI packages are unavailable (Admin returns empty docs)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ docs: [] }),
        }),
      );

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', {
        method: 'POST',
      });

      expect(res.status).toBe(403);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('requires a Pro or Enterprise license');
    });

    it('returns 403 when AI packages are unavailable (Admin returns docs without docs key)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({}),
        }),
      );

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', {
        method: 'POST',
      });

      expect(res.status).toBe(403);
      const body = await parseBody(res);
      expect(body.error).toContain('requires a Pro or Enterprise license');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });
  });

  describe('GET /rag/workspaces/:workspaceId/documents', () => {
    it('returns documents for workspace', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'Test', status: 'indexed' },
        { id: 'doc-2', title: 'Test 2', status: 'pending' },
      ];

      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockDocs),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/documents');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.documents).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('returns empty list when no documents', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/documents');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.documents).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('propagates error when vector DB query throws', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('DB connection lost')),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-2/documents');

      // Hono returns 500 for unhandled errors
      expect(res.status).toBe(500);
    });

    it('returns correct total matching the document count', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'A', status: 'indexed' },
        { id: 'doc-2', title: 'B', status: 'indexed' },
        { id: 'doc-3', title: 'C', status: 'pending' },
      ];

      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockDocs),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-3/documents');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.total).toBe(3);
      expect(body.documents).toHaveLength(3);
    });
  });

  describe('DELETE /rag/workspaces/:workspaceId/documents/:documentId', () => {
    it('returns 403 when AI package is not available', async () => {
      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/documents/doc-1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(403);
      const body = await parseBody(res);
      expect(body.error).toContain('requires a Pro or Enterprise license');
    });

    it('returns 403 response with correct code field when AI unavailable', async () => {
      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/documents/doc-42', {
        method: 'DELETE',
      });

      expect(res.status).toBe(403);
      const body = await parseBody(res);
      expect(body.code).toBe('HTTP_403');
      expect(body.success).toBe(false);
    });
  });

  describe('GET /rag/workspaces/:workspaceId/status', () => {
    it('returns workspace stats', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 10 }]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-1/status');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.workspaceId).toBe('ws-1');
      expect(body.totalDocuments).toBeDefined();
    });

    it('returns all four fields in the status response', async () => {
      // The status route issues 4 queries; return consistent totals for simplicity
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 5, lastIndexedAt: null }]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-2/status');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.workspaceId).toBe('ws-2');
      expect(typeof body.totalDocuments).toBe('number');
      expect(typeof body.indexedDocuments).toBe('number');
      expect(typeof body.pendingDocuments).toBe('number');
      expect('lastIndexedAt' in body).toBe(true);
    });

    it('returns zeros and null when workspace has no documents', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/empty-ws/status');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.totalDocuments).toBe(0);
      expect(body.indexedDocuments).toBe(0);
      expect(body.pendingDocuments).toBe(0);
      expect(body.lastIndexedAt).toBeNull();
    });

    it('propagates error when vector DB status query throws', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('vector DB unavailable')),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any);

      const app = createApp();

      const res = await app.request('/rag/workspaces/ws-fail/status');

      expect(res.status).toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------
// AI-available path tests — requires fresh module isolation
// ---------------------------------------------------------------------------
describe('rag-index routes — AI available', () => {
  // biome-ignore lint/suspicious/noExplicitAny: module loaded after vi.resetModules — type unavailable at declaration site
  let freshRagApp: any;
  let freshGetVectorClient: ReturnType<typeof vi.fn>;
  let freshGetRestClient: ReturnType<typeof vi.fn>;
  let mockIngest: ReturnType<typeof vi.fn>;
  let mockDeleteDocument: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    vi.resetModules();

    mockIngest = vi.fn();
    mockDeleteDocument = vi.fn();
    freshGetVectorClient = vi.fn();
    freshGetRestClient = vi.fn();

    vi.doMock('@revealui/db/client', () => ({
      getVectorClient: freshGetVectorClient,
      getRestClient: freshGetRestClient,
    }));

    vi.doMock('@revealui/db/schema/rag', () => ({
      ragDocuments: {
        workspaceId: 'workspaceId',
        status: 'status',
        indexedAt: 'indexedAt',
      },
    }));

    vi.doMock('@revealui/ai/embeddings', () => ({
      generateEmbedding: vi.fn().mockResolvedValue({ vector: [0.1, 0.2, 0.3] }),
    }));

    vi.doMock('@revealui/ai/ingestion', () => ({
      IngestionPipeline: class {
        ingest = mockIngest;
        deleteDocument = mockDeleteDocument;
      },
    }));

    const mod = await import('../rag-index.js');
    freshRagApp = mod.default;
  });

  afterAll(() => {
    vi.resetModules();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // biome-ignore lint/suspicious/noExplicitAny: test helper
  function createFreshApp(dbMock?: any) {
    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const app = new Hono<{ Variables: { db: any; tenant: any; user: any } }>();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'test-user', role: 'admin' });
      if (dbMock) c.set('db', dbMock);
      await next();
    });
    app.route('/rag', freshRagApp);
    return app;
  }

  describe('POST /rag/workspaces/:workspaceId/index/:collection', () => {
    it('returns 200 with correct shape when admin returns zero documents', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ docs: [] }),
        }),
      );

      freshGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', { method: 'POST' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.total).toBe(0);
      expect(body.indexed).toBe(0);
      expect(body.failed).toBe(0);
      expect(body.collection).toBe('posts');
      expect(body.workspaceId).toBe('ws-1');
      expect(body.status).toBe('completed');
      expect(typeof body.jobId).toBe('string');

      vi.unstubAllGlobals();
    });

    it('returns 200 and indexes all documents when admin returns docs', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            docs: [
              { id: 'doc-1', title: 'Post One', content: 'Hello world' },
              { id: 'doc-2', title: 'Post Two', content: 'Another post' },
            ],
          }),
        }),
      );

      freshGetVectorClient.mockReturnValue({});
      mockIngest.mockResolvedValue({ status: 'indexed' });

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', { method: 'POST' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.total).toBe(2);
      expect(body.indexed).toBe(2);
      expect(body.failed).toBe(0);
      expect(mockIngest).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    });

    it('counts failed documents correctly when some ingestions fail', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            docs: [
              { id: 'doc-1', title: 'Good', content: 'ok' },
              { id: 'doc-2', title: 'Bad', content: 'fail' },
              { id: 'doc-3', title: 'Good 2', content: 'ok' },
            ],
          }),
        }),
      );

      freshGetVectorClient.mockReturnValue({});
      mockIngest
        .mockResolvedValueOnce({ status: 'indexed' })
        .mockResolvedValueOnce({ status: 'failed' })
        .mockResolvedValueOnce({ status: 'indexed' });

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', { method: 'POST' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(3);
      expect(body.indexed).toBe(2);
      expect(body.failed).toBe(1);

      vi.unstubAllGlobals();
    });

    it('falls back to JSON.stringify for docs without content or rawContent', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            docs: [{ id: 'doc-1', title: 'Title Only' }],
          }),
        }),
      );

      freshGetVectorClient.mockReturnValue({});
      mockIngest.mockResolvedValue({ status: 'indexed' });

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/ws-1/index/posts', { method: 'POST' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.indexed).toBe(1);
      // Verify ingest was called — the rawContent will be the JSON-stringified doc
      expect(mockIngest).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'doc-1',
          title: 'Title Only',
          mimeType: 'text/plain',
        }),
      );

      vi.unstubAllGlobals();
    });

    it('uses rawContent field when content is absent', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            docs: [{ id: 'doc-1', title: 'Raw', rawContent: 'raw text here' }],
          }),
        }),
      );

      freshGetVectorClient.mockReturnValue({});
      mockIngest.mockResolvedValue({ status: 'indexed' });

      const app = createFreshApp();

      await app.request('/rag/workspaces/ws-1/index/posts', { method: 'POST' });

      expect(mockIngest).toHaveBeenCalledWith(
        expect.objectContaining({ rawContent: 'raw text here' }),
      );

      vi.unstubAllGlobals();
    });

    it('jobId includes workspaceId and collection name', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ docs: [] }),
        }),
      );

      freshGetVectorClient.mockReturnValue({});

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/my-workspace/index/my-collection', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.jobId).toContain('my-workspace');
      expect(body.jobId).toContain('my-collection');

      vi.unstubAllGlobals();
    });
  });

  describe('DELETE /rag/workspaces/:workspaceId/documents/:documentId — AI available', () => {
    it('returns 200 and deletes the document when AI is available', async () => {
      freshGetVectorClient.mockReturnValue({});
      mockDeleteDocument.mockResolvedValue(undefined);

      const app = createFreshApp();

      const res = await app.request('/rag/workspaces/ws-1/documents/doc-99', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.documentId).toBe('doc-99');
    });

    it('calls deleteDocument with the correct documentId', async () => {
      freshGetVectorClient.mockReturnValue({});
      mockDeleteDocument.mockResolvedValue(undefined);

      const app = createFreshApp();

      await app.request('/rag/workspaces/ws-1/documents/specific-doc-id', {
        method: 'DELETE',
      });

      expect(mockDeleteDocument).toHaveBeenCalledWith('specific-doc-id');
    });
  });
});
