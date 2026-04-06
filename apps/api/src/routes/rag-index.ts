/**
 * RAG Index Routes
 *
 * POST /api/rag/workspaces/:workspaceId/index/:collection  → trigger indexing
 * GET  /api/rag/workspaces/:workspaceId/documents          → list documents
 * DELETE /api/rag/workspaces/:workspaceId/documents/:documentId
 * GET  /api/rag/workspaces/:workspaceId/status             → workspace RAG stats
 *
 * Requires requireFeature('ai', { mode: 'entitlements' }) — applied in apps/api/src/index.ts.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { getRestClient, getVectorClient } from '@revealui/db/client';
import { ragDocuments } from '@revealui/db/schema/rag';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, eq, isNotNull, max } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

type Variables = {
  db: DatabaseClient;
  tenant?: { id: string };
  user?: { id: string; role: string };
};

/** Verify the user is authenticated and the workspaceId matches the tenant context. */
function assertWorkspaceAccess(
  user: { id: string; role: string } | undefined,
  workspaceId: string,
  tenant: { id: string } | undefined,
): void {
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  // In multi-tenant mode, workspaceId must match the tenant context (admin bypass)
  if (tenant && workspaceId !== tenant.id && user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Access denied for this workspace' });
  }
}

/** Validate collection name: alphanumeric, underscores, hyphens only */
function isValidCollectionName(name: string): boolean {
  if (name.length === 0) return false;
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    const isAlpha = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const isDigit = c >= 48 && c <= 57;
    if (!(isAlpha || isDigit || c === 95 || c === 45)) return false;
  }
  return true;
}

const app = new OpenAPIHono<{ Variables: Variables }>();

// =============================================================================
// POST /api/rag/workspaces/:workspaceId/index/:collection
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/workspaces/{workspaceId}/index/{collection}',
    tags: ['rag'],
    summary: 'Trigger RAG indexing for a CMS collection',
    request: {
      params: z.object({
        workspaceId: z.string().openapi({ description: 'Workspace ID' }),
        collection: z.string().openapi({ description: 'CMS collection name' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              jobId: z.string(),
              collection: z.string(),
              workspaceId: z.string(),
              total: z.number(),
              indexed: z.number(),
              failed: z.number(),
              status: z.string(),
            }),
          },
        },
        description: 'Indexing completed',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid collection name',
      },
      502: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'CMS fetch error',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const { workspaceId, collection } = c.req.valid('param');
    assertWorkspaceAccess(c.get('user'), workspaceId, c.get('tenant'));

    if (!isValidCollectionName(collection)) {
      return c.json({ success: false, error: 'Invalid collection name' }, 400);
    }

    // CMS API client — requires NEXT_PUBLIC_CMS_URL or CMS_URL
    const cmsBaseUrl =
      process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? 'http://localhost:4000';

    let documents: Array<{ id: string; title?: string; content?: string; rawContent?: string }> =
      [];

    try {
      // Paginated fetch from CMS collection REST API
      const res = await fetch(`${cmsBaseUrl}/api/${collection}?limit=100&depth=0`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(300_000), // 5 minute timeout
      });

      if (!res.ok) {
        return c.json({ success: false, error: `CMS fetch failed: HTTP ${res.status}` }, 502);
      }

      const data = (await res.json()) as { docs?: typeof documents };
      documents = data.docs ?? [];
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'CMS fetch error: upstream service unavailable',
        },
        502,
      );
    }

    const [embeddingsMod, ingestionMod] = await Promise.all([
      import('@revealui/ai/embeddings').catch(() => null),
      import('@revealui/ai/ingestion').catch(() => null),
    ]);

    if (!(embeddingsMod && ingestionMod)) {
      return c.json(
        {
          success: false,
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
          code: 'HTTP_403',
        },
        403,
      );
    }

    const vectorDb = getVectorClient();
    const restDb = getRestClient();
    const embeddingFn = async (text: string): Promise<number[]> => {
      const emb = await embeddingsMod.generateEmbedding(text);
      return emb.vector;
    };

    // Type assertion needed: workspace @revealui/db and npm @revealui/db resolve
    // to structurally identical but nominally different Database types.
    type PipelineDb = ConstructorParameters<typeof ingestionMod.IngestionPipeline>[0];
    const pipeline = new ingestionMod.IngestionPipeline(
      vectorDb as unknown as PipelineDb,
      restDb as unknown as PipelineDb,
      embeddingFn,
    );

    let indexed = 0;
    let failed = 0;
    const jobId = `rag-index-${workspaceId}-${collection}-${Date.now()}`;

    // Run indexing synchronously (background queue deferred)
    for (const doc of documents) {
      const rawContent =
        typeof doc.content === 'string'
          ? doc.content
          : typeof doc.rawContent === 'string'
            ? doc.rawContent
            : JSON.stringify(doc);

      const result = await pipeline.ingest({
        workspaceId,
        sourceType: 'cms_collection',
        sourceCollection: collection,
        sourceId: String(doc.id),
        title: doc.title ?? `${collection}/${doc.id}`,
        mimeType: 'text/plain',
        rawContent,
      });

      if (result.status === 'indexed') {
        indexed++;
      } else {
        failed++;
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
    });
  },
);

// =============================================================================
// GET /api/rag/workspaces/:workspaceId/documents
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/workspaces/{workspaceId}/documents',
    tags: ['rag'],
    summary: 'List documents in a workspace',
    request: {
      params: z.object({
        workspaceId: z.string().openapi({ description: 'Workspace ID' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              documents: z.array(z.unknown()),
              total: z.number(),
            }),
          },
        },
        description: 'Document list',
      },
    },
  }),
  async (c) => {
    const { workspaceId } = c.req.valid('param');
    assertWorkspaceAccess(c.get('user'), workspaceId, c.get('tenant'));

    const vectorDb = getVectorClient();

    const docs = await vectorDb
      .select()
      .from(ragDocuments)
      .where(eq(ragDocuments.workspaceId, workspaceId));

    return c.json({ success: true, documents: docs, total: docs.length });
  },
);

// =============================================================================
// DELETE /api/rag/workspaces/:workspaceId/documents/:documentId
// =============================================================================

app.openapi(
  createRoute({
    method: 'delete',
    path: '/workspaces/{workspaceId}/documents/{documentId}',
    tags: ['rag'],
    summary: 'Delete a RAG document',
    request: {
      params: z.object({
        workspaceId: z.string().openapi({ description: 'Workspace ID' }),
        documentId: z.string().openapi({ description: 'Document ID' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              documentId: z.string(),
            }),
          },
        },
        description: 'Document deleted',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const { documentId } = c.req.valid('param');

    const [embeddingsMod, ingestionMod] = await Promise.all([
      import('@revealui/ai/embeddings').catch(() => null),
      import('@revealui/ai/ingestion').catch(() => null),
    ]);

    if (!(embeddingsMod && ingestionMod)) {
      return c.json(
        {
          success: false,
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
          code: 'HTTP_403',
        },
        403,
      );
    }

    const vectorDb = getVectorClient();
    const restDb = getRestClient();

    const embeddingFn = async (text: string): Promise<number[]> => {
      const emb = await embeddingsMod.generateEmbedding(text);
      return emb.vector;
    };
    // Type assertion: workspace vs npm @revealui/db nominal type mismatch (structurally identical)
    type PipelineDb = ConstructorParameters<typeof ingestionMod.IngestionPipeline>[0];
    const pipeline = new ingestionMod.IngestionPipeline(
      vectorDb as unknown as PipelineDb,
      restDb as unknown as PipelineDb,
      embeddingFn,
    );
    await pipeline.deleteDocument(documentId);

    return c.json({ success: true, documentId });
  },
);

// =============================================================================
// GET /api/rag/workspaces/:workspaceId/status
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/workspaces/{workspaceId}/status',
    tags: ['rag'],
    summary: 'Get workspace RAG indexing status',
    request: {
      params: z.object({
        workspaceId: z.string().openapi({ description: 'Workspace ID' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              workspaceId: z.string(),
              totalDocuments: z.number(),
              indexedDocuments: z.number(),
              pendingDocuments: z.number(),
              lastIndexedAt: z.string().nullable(),
            }),
          },
        },
        description: 'Workspace RAG status',
      },
    },
  }),
  async (c) => {
    const { workspaceId } = c.req.valid('param');
    assertWorkspaceAccess(c.get('user'), workspaceId, c.get('tenant'));

    const vectorDb = getVectorClient();

    const [totalRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(eq(ragDocuments.workspaceId, workspaceId));

    const [indexedRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(and(eq(ragDocuments.workspaceId, workspaceId), eq(ragDocuments.status, 'indexed')));

    const [pendingRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(and(eq(ragDocuments.workspaceId, workspaceId), eq(ragDocuments.status, 'pending')));

    const [lastRow] = await vectorDb
      .select({ lastIndexedAt: max(ragDocuments.indexedAt) })
      .from(ragDocuments)
      .where(and(eq(ragDocuments.workspaceId, workspaceId), isNotNull(ragDocuments.indexedAt)));

    return c.json({
      success: true,
      workspaceId,
      totalDocuments: totalRow?.total ?? 0,
      indexedDocuments: indexedRow?.total ?? 0,
      pendingDocuments: pendingRow?.total ?? 0,
      lastIndexedAt: lastRow?.lastIndexedAt ?? null,
    });
  },
);

export default app;
