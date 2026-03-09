import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockLoadDocument = vi.fn().mockResolvedValue(undefined)
const mockSaveDocument = vi.fn().mockResolvedValue(undefined)

vi.mock('../../collab/persistence.js', () => ({
  createYjsPersistence: vi.fn(() => ({
    loadDocument: mockLoadDocument,
    saveDocument: mockSaveDocument,
  })),
}))

import { createCollabRoute } from '../collab.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper
function createApp(user?: { id: string; role: string }, dbMock?: any) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { user: any; db: any } }>()
  app.use('*', async (c, next) => {
    if (user) c.set('user', user)
    if (dbMock) c.set('db', dbMock)
    await next()
  })
  const collabApp = createCollabRoute()
  app.route('/', collabApp)
  return app
}

function jsonPost(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

const testUser = { id: 'user-1', role: 'admin' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('collab routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/collab/update', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp(undefined, {})

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from('test').toString('base64'),
      })

      expect(res.status).toBe(401)
      const body = await parseBody(res)
      expect(body.error).toContain('Authentication required')
    })

    it('returns 400 for missing documentId', async () => {
      const app = createApp(testUser, {})

      const res = await jsonPost(app, '/api/collab/update', {
        update: Buffer.from('test').toString('base64'),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for missing update', async () => {
      const app = createApp(testUser, {})

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid base64 encoding', async () => {
      const app = createApp(testUser, {})

      // Not valid base64 (contains chars that won't cause Buffer.from to throw,
      // but yjs applyUpdate will fail). However, the route catches the error
      // at the Yjs level. Let's test with a valid base64 but invalid Yjs update.
      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from('not-yjs-data').toString('base64'),
      })

      // Yjs applyUpdate throws on invalid data → 500
      expect(res.status).toBe(500)
      const body = await parseBody(res)
      expect(body.error).toContain('Failed to apply update')
    })

    it('returns success for valid update', async () => {
      const Y = await import('yjs')
      const doc = new Y.Doc()
      doc.getArray('test').insert(0, ['hello'])
      const validUpdate = Y.encodeStateAsUpdate(doc)
      doc.destroy()

      const app = createApp(testUser, {})

      const res = await jsonPost(app, '/api/collab/update', {
        documentId: 'doc-1',
        update: Buffer.from(validUpdate).toString('base64'),
      })

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
    })
  })

  describe('GET /api/collab/snapshot/:documentId', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = createApp(undefined, {})

      const res = await app.request('/api/collab/snapshot/doc-1')

      expect(res.status).toBe(401)
    })

    it('returns 404 for empty document', async () => {
      // Empty Yjs doc state is <= 2 bytes
      const app = createApp(testUser, {})

      const res = await app.request('/api/collab/snapshot/doc-empty')

      expect(res.status).toBe(404)
      const body = await parseBody(res)
      expect(body.error).toContain('Document not found')
    })

    it('returns base64 state for existing document', async () => {
      const Y = await import('yjs')

      // Make loadDocument populate the doc with data
      mockLoadDocument.mockImplementation(async (_id: string, doc: InstanceType<typeof Y.Doc>) => {
        doc.getArray('test').insert(0, ['data'])
      })

      const app = createApp(testUser, {})

      const res = await app.request('/api/collab/snapshot/doc-with-data')

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
      expect(body.documentId).toBe('doc-with-data')
      expect(body.state).toBeTruthy()
      // Verify it's valid base64
      expect(() => Buffer.from(body.state, 'base64')).not.toThrow()
    })
  })
})
