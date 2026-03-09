import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/db/client', () => ({
  getVectorClient: vi.fn(),
}))

vi.mock('@revealui/db/schema/rag', () => ({
  ragDocuments: {
    workspaceId: 'workspaceId',
    status: 'status',
    indexedAt: 'indexedAt',
  },
}))

// Mock dynamic AI imports — default to unavailable
vi.mock('@revealui/ai/embeddings', () => {
  throw new Error('not available')
})
vi.mock('@revealui/ai/ingestion', () => {
  throw new Error('not available')
})

import { getVectorClient } from '@revealui/db/client'
import ragApp from '../rag-index.js'

const mockedGetVectorClient = vi.mocked(getVectorClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper
function createApp(dbMock?: any) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { db: any; tenant: any } }>()
  if (dbMock) {
    app.use('*', async (c, next) => {
      c.set('db', dbMock)
      await next()
    })
  }
  app.route('/rag', ragApp)
  return app
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('rag-index routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /rag/workspaces/:workspaceId/index/:collection', () => {
    it('rejects invalid collection names', async () => {
      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/index/invalid collection!', {
        method: 'POST',
      })

      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('Invalid collection name')
    })

    it('rejects collection names with special characters', async () => {
      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/index/my.collection', {
        method: 'POST',
      })

      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('Invalid collection name')
    })

    it('accepts valid collection names with alphanumeric, dashes, underscores', async () => {
      // Will fail at CMS fetch since we have no mock for global fetch,
      // but the collection name validation should pass
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))

      try {
        const app = createApp()

        const res = await app.request('/rag/workspaces/ws-1/index/valid-collection_1', {
          method: 'POST',
        })

        // Should get past validation — will fail at CMS fetch (502)
        expect(res.status).toBe(502)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('GET /rag/workspaces/:workspaceId/documents', () => {
    it('returns documents for workspace', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'Test', status: 'indexed' },
        { id: 'doc-2', title: 'Test 2', status: 'pending' },
      ]

      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockDocs),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any)

      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/documents')

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
      expect(body.documents).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it('returns empty list when no documents', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any)

      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/documents')

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.documents).toEqual([])
      expect(body.total).toBe(0)
    })
  })

  describe('DELETE /rag/workspaces/:workspaceId/documents/:documentId', () => {
    it('returns 503 when AI package is not available', async () => {
      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/documents/doc-1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(503)
      const body = await parseBody(res)
      expect(body.error).toContain('AI package not available')
    })
  })

  describe('GET /rag/workspaces/:workspaceId/status', () => {
    it('returns workspace stats', async () => {
      mockedGetVectorClient.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 10 }]),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock
      } as any)

      const app = createApp()

      const res = await app.request('/rag/workspaces/ws-1/status')

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
      expect(body.workspaceId).toBe('ws-1')
      expect(body.totalDocuments).toBeDefined()
    })
  })
})
