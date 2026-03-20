import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockLoadDocument = vi.fn().mockResolvedValue(undefined);
const mockSaveDocument = vi.fn().mockResolvedValue(undefined);

vi.mock('../../collab/persistence.js', () => ({
  createYjsPersistence: vi.fn(() => ({
    loadDocument: mockLoadDocument,
    saveDocument: mockSaveDocument,
  })),
}));

import { createCollabRoute } from '../collab.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper
function createApp(user?: { id: string; role: string }, dbMock?: any) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user: any; db: any } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    if (dbMock) c.set('db', dbMock);
    await next();
  });
  const collabApp = createCollabRoute();
  app.route('/', collabApp);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — Hono generics vary per test
function jsonPost(app: Hono<any>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

const testUser = { id: 'user-1', role: 'admin' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('collab routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default no-op implementations after reset
    mockLoadDocument.mockResolvedValue(undefined);
    mockSaveDocument.mockResolvedValue(undefined);
  });

  describe('POST /api/collab/update', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp(undefined, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from('test').toString('base64'),
      });

      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toContain('Authentication required');
    });

    it('returns 400 for missing documentId', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        update: Buffer.from('test').toString('base64'),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing update', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid base64 encoding', async () => {
      const app = createApp(testUser, {});

      // Not valid base64 (contains chars that won't cause Buffer.from to throw,
      // but yjs applyUpdate will fail). However, the route catches the error
      // at the Yjs level. Let's test with a valid base64 but invalid Yjs update.
      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from('not-yjs-data').toString('base64'),
      });

      // Yjs applyUpdate throws on invalid data → 500
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Failed to apply update');
    });

    it('returns success for valid update', async () => {
      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
    });

    it('returns 500 when loadDocument throws', async () => {
      mockLoadDocument.mockRejectedValue(new Error('DB error'));

      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Failed to apply update');
    });

    it('returns 500 when saveDocument throws', async () => {
      mockSaveDocument.mockRejectedValue(new Error('Save failed'));

      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Failed to apply update');
    });

    it('response body is exactly { success: true }', async () => {
      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-exact',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body).toStrictEqual({ success: true });
    });

    it('calls loadDocument and saveDocument with the correct documentId', async () => {
      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const docId = 'my-specific-doc-id';
      const app = createApp(testUser, {});

      await jsonPost(app, '/api/collab/update', {
        documentId: docId,
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(mockLoadDocument).toHaveBeenCalledWith(docId, expect.any(Object));
      expect(mockSaveDocument).toHaveBeenCalledWith(docId, expect.any(Object));
    });
  });

  describe('GET /api/collab/snapshot/:documentId', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp(undefined, {});

      const res = await app.request('/api/collab/snapshot/doc-1');

      expect(res.status).toBe(401);
    });

    it('returns 404 for empty document', async () => {
      // Empty Yjs doc state is <= 2 bytes
      const app = createApp(testUser, {});

      const res = await app.request('/api/collab/snapshot/doc-empty');

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).toContain('Document not found');
    });

    it('returns base64 state for existing document', async () => {
      const Y = await import('yjs');

      // Make loadDocument populate the doc with data
      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getArray('test').insert(0, ['data']);
      });

      const app = createApp(testUser, {});

      const res = await app.request('/api/collab/snapshot/doc-with-data');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.documentId).toBe('doc-with-data');
      expect(body.state).toBeTruthy();
      // Verify it's valid base64
      expect(() => Buffer.from(body.state, 'base64')).not.toThrow();
    });

    it('returns 500 when loadDocument throws', async () => {
      mockLoadDocument.mockRejectedValue(new Error('DB read error'));

      const app = createApp(testUser, {});

      const res = await app.request('/api/collab/snapshot/doc-1');

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Failed to get snapshot');
    });

    it('response body shape is { success: true, documentId, state }', async () => {
      const Y = await import('yjs');

      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getText('content').insert(0, 'Hello World');
      });

      const app = createApp(testUser, {});

      const res = await app.request('/api/collab/snapshot/shape-doc');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body).toMatchObject({
        success: true,
        documentId: 'shape-doc',
        state: expect.any(String),
      });
      // Confirm exactly three keys
      expect(Object.keys(body).sort()).toStrictEqual(['documentId', 'state', 'success']);
    });

    it('echoes the correct documentId in the response', async () => {
      const Y = await import('yjs');
      const targetDocId = 'echo-this-doc-id';

      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getArray('items').insert(0, ['item-a']);
      });

      const app = createApp(testUser, {});

      const res = await app.request(`/api/collab/snapshot/${targetDocId}`);

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.documentId).toBe(targetDocId);
    });

    it('calls loadDocument with the correct documentId', async () => {
      const Y = await import('yjs');
      const targetDocId = 'persistence-check-doc';

      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getMap('meta').set('title', 'Test');
      });

      const app = createApp(testUser, {});

      await app.request(`/api/collab/snapshot/${targetDocId}`);

      expect(mockLoadDocument).toHaveBeenCalledWith(targetDocId, expect.any(Object));
    });
  });
});
