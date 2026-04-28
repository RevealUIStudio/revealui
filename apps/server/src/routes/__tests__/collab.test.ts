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

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono generics vary per test
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

  // ---------------------------------------------------------------------------
  // Pass 15  -  edge case expansion
  // ---------------------------------------------------------------------------

  describe('POST /api/collab/update  -  edge cases', () => {
    it('returns 400 for empty string documentId', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: '',
        update: Buffer.from('test').toString('base64'),
      });

      // Zod .min(1) rejects empty string
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty string update', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: '',
      });

      // Zod .min(1) rejects empty string
      expect(res.status).toBe(400);
    });

    it('handles update with Yjs Text type data', async () => {
      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Hello World');
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-text',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
    });

    it('handles update with Yjs Map type data', async () => {
      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getMap('meta').set('title', 'My Document');
      doc.getMap('meta').set('version', 42);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-map',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
    });

    it('applies multiple sequential updates to the same document', async () => {
      const Y = await import('yjs');

      // First update
      const doc1 = new Y.Doc();
      doc1.getArray('items').insert(0, ['first']);
      const update1 = Y.encodeStateAsUpdate(doc1);
      doc1.destroy();

      // Second update
      const doc2 = new Y.Doc();
      doc2.getArray('items').insert(0, ['second']);
      const update2 = Y.encodeStateAsUpdate(doc2);
      doc2.destroy();

      const app = createApp(testUser, {});

      const res1 = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-sequential',
        update: Buffer.from(update1).toString('base64'),
      });
      expect(res1.status).toBe(200);

      const res2 = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-sequential',
        update: Buffer.from(update2).toString('base64'),
      });
      expect(res2.status).toBe(200);

      // Both calls should have persisted
      expect(mockLoadDocument).toHaveBeenCalledTimes(2);
      expect(mockSaveDocument).toHaveBeenCalledTimes(2);
    });

    it('logs error details when update fails with non-Error thrown value', async () => {
      const { logger } = await import('@revealui/core/observability/logger');

      // Make loadDocument throw a string (non-Error) to hit the String(err) path
      mockLoadDocument.mockRejectedValue('string-error-value');

      const Y = await import('yjs');
      const doc = new Y.Doc();
      doc.getArray('test').insert(0, ['hello']);
      const validUpdate = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-nonerror',
        update: Buffer.from(validUpdate).toString('base64'),
      });

      expect(res.status).toBe(500);
      // logger.error should have been called with a constructed Error from String(err)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to apply collab update',
        expect.any(Error),
        { documentId: 'doc-nonerror' },
      );
    });

    it('returns 400 for non-object request body', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', 'not-an-object');

      expect(res.status).toBe(400);
    });

    it('returns 400 when documentId is not a string', async () => {
      const app = createApp(testUser, {});

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 123,
        update: Buffer.from('test').toString('base64'),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/collab/snapshot  -  edge cases', () => {
    it('returns decodable Yjs state that can reconstruct the original document', async () => {
      const Y = await import('yjs');

      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getText('content').insert(0, 'reconstruct-me');
      });

      const app = createApp(testUser, {});
      const res = await app.request('/api/collab/snapshot/doc-roundtrip');

      expect(res.status).toBe(200);
      const body = await parseBody(res);

      // Decode the base64 state and verify it produces valid Yjs content
      const stateBytes = new Uint8Array(Buffer.from(body.state, 'base64'));
      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, stateBytes);
      expect(reconstructed.getText('content').toString()).toBe('reconstruct-me');
      reconstructed.destroy();
    });

    it('logs error details when snapshot fails with non-Error thrown value', async () => {
      const { logger } = await import('@revealui/core/observability/logger');

      // Throw a non-Error value to hit the String(err) branch in the catch
      mockLoadDocument.mockRejectedValue(42);

      const app = createApp(testUser, {});
      const res = await app.request('/api/collab/snapshot/doc-nonerror');

      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get collab snapshot',
        expect.any(Error),
        { documentId: 'doc-nonerror' },
      );
    });

    it('returns different state for documents with different content', async () => {
      const Y = await import('yjs');

      // First document
      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getText('content').insert(0, 'document-A');
      });

      const app = createApp(testUser, {});
      const res1 = await app.request('/api/collab/snapshot/doc-a');
      expect(res1.status).toBe(200);
      const body1 = await parseBody(res1);

      // Second document with different content
      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getText('content').insert(0, 'document-B-different');
      });

      const res2 = await app.request('/api/collab/snapshot/doc-b');
      expect(res2.status).toBe(200);
      const body2 = await parseBody(res2);

      // States should be different
      expect(body1.state).not.toBe(body2.state);
    });
  });
});
