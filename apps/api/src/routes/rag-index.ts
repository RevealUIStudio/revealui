/**
 * RAG Index Routes
 *
 * POST /api/rag/workspaces/:workspaceId/index/:collection  → trigger indexing
 * GET  /api/rag/workspaces/:workspaceId/documents          → list documents
 * DELETE /api/rag/workspaces/:workspaceId/documents/:documentId
 * GET  /api/rag/workspaces/:workspaceId/status             → workspace RAG stats
 *
 * Requires requireFeature('ai') — applied in apps/api/src/index.ts.
 */

import { generateEmbedding } from '@revealui/ai/embeddings'
import { IngestionPipeline } from '@revealui/ai/ingestion'
import type { DatabaseClient } from '@revealui/db/client'
import { getVectorClient } from '@revealui/db/client'
import { ragDocuments } from '@revealui/db/schema/rag'
import { and, count, eq, isNotNull, max } from 'drizzle-orm'
import { Hono } from 'hono'

type Variables = {
  db: DatabaseClient
  tenant?: { id: string }
}

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
const app = new Hono<{ Variables: Variables }>()

// =============================================================================
// POST /api/rag/workspaces/:workspaceId/index/:collection
// =============================================================================

app.post('/workspaces/:workspaceId/index/:collection', async (c) => {
  const { workspaceId, collection } = c.req.param()

  // CMS API client — requires NEXT_PUBLIC_CMS_URL or CMS_URL
  const cmsBaseUrl =
    process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? 'http://localhost:4000'

  let documents: Array<{ id: string; title?: string; content?: string; rawContent?: string }> = []

  try {
    // Paginated fetch from CMS collection REST API
    const res = await fetch(`${cmsBaseUrl}/api/${collection}?limit=100&depth=0`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300_000), // 5 minute timeout
    })

    if (!res.ok) {
      return c.json({ success: false, error: `CMS fetch failed: HTTP ${res.status}` }, 502)
    }

    const data = (await res.json()) as { docs?: typeof documents }
    documents = data.docs ?? []
  } catch (error) {
    return c.json(
      {
        success: false,
        error: `CMS fetch error: ${error instanceof Error ? error.message : String(error)}`,
      },
      502,
    )
  }

  const vectorDb = getVectorClient()
  const embeddingFn = async (text: string): Promise<number[]> => {
    const emb = await generateEmbedding(text)
    return emb.vector
  }

  const pipeline = new IngestionPipeline(vectorDb, embeddingFn)

  let indexed = 0
  let failed = 0
  const jobId = `rag-index-${workspaceId}-${collection}-${Date.now()}`

  // Run indexing synchronously (background queue deferred)
  for (const doc of documents) {
    const rawContent =
      typeof doc.content === 'string'
        ? doc.content
        : typeof doc.rawContent === 'string'
          ? doc.rawContent
          : JSON.stringify(doc)

    const result = await pipeline.ingest({
      workspaceId,
      sourceType: 'cms_collection',
      sourceCollection: collection,
      sourceId: String(doc.id),
      title: doc.title ?? `${collection}/${doc.id}`,
      mimeType: 'text/plain',
      rawContent,
    })

    if (result.status === 'indexed') {
      indexed++
    } else {
      failed++
    }
  }

  return c.json({
    success: true,
    jobId,
    collection,
    workspaceId,
    total: documents.length,
    indexed,
    failed,
    status: 'completed',
  })
})

// =============================================================================
// GET /api/rag/workspaces/:workspaceId/documents
// =============================================================================

app.get('/workspaces/:workspaceId/documents', async (c) => {
  const { workspaceId } = c.req.param()
  const vectorDb = getVectorClient()

  const docs = await vectorDb
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.workspaceId, workspaceId))

  return c.json({ success: true, documents: docs, total: docs.length })
})

// =============================================================================
// DELETE /api/rag/workspaces/:workspaceId/documents/:documentId
// =============================================================================

app.delete('/workspaces/:workspaceId/documents/:documentId', async (c) => {
  const { documentId } = c.req.param()
  const vectorDb = getVectorClient()

  const embeddingFn = async (text: string): Promise<number[]> => {
    const emb = await generateEmbedding(text)
    return emb.vector
  }
  const pipeline = new IngestionPipeline(vectorDb, embeddingFn)
  await pipeline.deleteDocument(documentId)

  return c.json({ success: true, documentId })
})

// =============================================================================
// GET /api/rag/workspaces/:workspaceId/status
// =============================================================================

app.get('/workspaces/:workspaceId/status', async (c) => {
  const { workspaceId } = c.req.param()
  const vectorDb = getVectorClient()

  const [totalRow] = await vectorDb
    .select({ total: count() })
    .from(ragDocuments)
    .where(eq(ragDocuments.workspaceId, workspaceId))

  const [indexedRow] = await vectorDb
    .select({ total: count() })
    .from(ragDocuments)
    .where(and(eq(ragDocuments.workspaceId, workspaceId), eq(ragDocuments.status, 'indexed')))

  const [pendingRow] = await vectorDb
    .select({ total: count() })
    .from(ragDocuments)
    .where(and(eq(ragDocuments.workspaceId, workspaceId), eq(ragDocuments.status, 'pending')))

  const [lastRow] = await vectorDb
    .select({ lastIndexedAt: max(ragDocuments.indexedAt) })
    .from(ragDocuments)
    .where(and(eq(ragDocuments.workspaceId, workspaceId), isNotNull(ragDocuments.indexedAt)))

  return c.json({
    success: true,
    workspaceId,
    totalDocuments: totalRow?.total ?? 0,
    indexedDocuments: indexedRow?.total ?? 0,
    pendingDocuments: pendingRow?.total ?? 0,
    lastIndexedAt: lastRow?.lastIndexedAt ?? null,
  })
})

export default app
