/**
 * RAG Index Routes
 *
 * POST /api/rag/workspaces/:workspaceId/index/:collection  → trigger indexing
 * GET  /api/rag/workspaces/:workspaceId/documents          → list documents
 * DELETE /api/rag/workspaces/:workspaceId/documents/:documentId
 * GET  /api/rag/workspaces/:workspaceId/status             → workspace RAG stats
 *
 * Requires requireFeature('ai', { mode: 'entitlements' })  -  applied in apps/server/src/index.ts.
 */

import { getExplicitDeploymentMode, isHostedDeployment } from '@revealui/core/deployment-mode';
import type { DatabaseClient } from '@revealui/db/client';
import { getRestClient } from '@revealui/db/client';
import { getPagesBySite } from '@revealui/db/queries/pages';
import {
  actorCanManageSite,
  actorCanReadSite,
  getSiteContentActor,
} from '@revealui/db/queries/sites';
import { ragDocuments } from '@revealui/db/schema/rag';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, eq, isNotNull, max } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { asLLMNotConfigured } from '../lib/llm-not-configured.js';
import { noStoreCacheMiddleware } from '../middleware/cache-control.js';

type Variables = {
  db: DatabaseClient;
  tenant?: { id: string };
  user?: { id: string; role: string };
};

/** Resolve current canonical membership; shell roles and tenant labels grant no access. */
async function assertWorkspaceAccess(
  db: DatabaseClient,
  user: { id: string; role: string } | undefined,
  workspaceId: string,
  write = false,
): Promise<void> {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  const actor = await getSiteContentActor(db, user.id);
  const mode = getExplicitDeploymentMode();
  const allowed =
    actor &&
    (write
      ? await actorCanManageSite(db, actor, workspaceId, mode, 'edit')
      : await actorCanReadSite(db, actor, workspaceId, mode));
  if (!allowed) throw new HTTPException(403, { message: 'Access denied for this workspace' });
}

async function readCondition(db: DatabaseClient, userId: string | undefined) {
  const ingestion = await import('@revealui/ai/ingestion').catch(() => null);
  if (!ingestion) throw new HTTPException(403, { message: 'RAG requires AI access' });
  return ingestion.ragDocumentReadCondition(db, {
    userId,
    deploymentMode: getExplicitDeploymentMode(),
  });
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

type EmbeddingModule = Pick<typeof import('@revealui/ai/embeddings'), 'generateEmbedding'>;

/**
 * Embed with the caller's resolved key. Hosted with no key throws
 * LLM_NOT_CONFIGURED. Forge resolves the deployment env client inside the resolver.
 */
async function customerEmbeddingFn(
  userId: string,
  workspaceId: string,
  db: DatabaseClient,
  embeddingsMod: EmbeddingModule,
): Promise<(text: string) => Promise<number[]>> {
  const llmMod = await import('@revealui/ai/llm/server');
  const client = await llmMod.resolveLLMClientForRequest(
    userId,
    db as unknown as Parameters<typeof llmMod.resolveLLMClientForRequest>[1],
    {
      isHosted: isHostedDeployment(process.env),
      workspaceId,
    },
  );
  return async (text: string): Promise<number[]> => {
    const emb = await embeddingsMod.generateEmbedding(text, { client });
    return emb.vector;
  };
}

const app = new OpenAPIHono<{ Variables: Variables }>();
app.use('*', noStoreCacheMiddleware());

// =============================================================================
// POST /api/rag/workspaces/:workspaceId/index/:collection
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/workspaces/{workspaceId}/index/{collection}',
    tags: ['rag'],
    summary: 'Trigger RAG indexing for an admin collection',
    request: {
      params: z.object({
        workspaceId: z.string().openapi({ description: 'Workspace ID' }),
        collection: z.string().openapi({ description: 'Admin collection name' }),
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
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
      409: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'No per-account LLM key on a hosted deployment',
      },
    },
  }),
  async (c) => {
    const { workspaceId, collection } = c.req.valid('param');
    const user = c.get('user');
    const vectorDb = c.get('db') ?? getRestClient();
    await assertWorkspaceAccess(vectorDb, user, workspaceId);

    if (!isValidCollectionName(collection)) {
      return c.json({ success: false, error: 'Invalid collection name' }, 400);
    }

    if (collection !== 'pages') {
      return c.json({ success: false, error: 'Only site-backed pages support CMS indexing' }, 400);
    }
    await assertWorkspaceAccess(vectorDb, c.get('user'), workspaceId, true);
    const documents = await getPagesBySite(vectorDb, workspaceId);

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

    const restDb = vectorDb;
    let embeddingFn: (text: string) => Promise<number[]>;
    try {
      if (!user) throw new HTTPException(401, { message: 'Authentication required' });
      embeddingFn = await customerEmbeddingFn(user.id, workspaceId, vectorDb, embeddingsMod);
    } catch (err) {
      const notConfigured = asLLMNotConfigured(err);
      if (notConfigured) return c.json(notConfigured, 409);
      throw err;
    }

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
      const result = await pipeline.ingest({
        workspaceId,
        sourceType: 'admin_collection',
        sourceCollection: collection,
        sourceId: String(doc.id),
        rawContent: '', // Pipeline reads the canonical source from the database.
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
    const vectorDb = c.get('db') ?? getRestClient();
    await assertWorkspaceAccess(vectorDb, c.get('user'), workspaceId);

    const docs = await vectorDb
      .select()
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.workspaceId, workspaceId),
          await readCondition(vectorDb, c.get('user')?.id),
        ),
      );

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
    const { workspaceId, documentId } = c.req.valid('param');
    const vectorDb = c.get('db') ?? getRestClient();
    await assertWorkspaceAccess(vectorDb, c.get('user'), workspaceId);

    await assertWorkspaceAccess(vectorDb, c.get('user'), workspaceId, true);
    const deleted = await vectorDb
      .delete(ragDocuments)
      .where(and(eq(ragDocuments.id, documentId), eq(ragDocuments.workspaceId, workspaceId)))
      .returning({ id: ragDocuments.id });
    if (deleted.length === 0) throw new HTTPException(404, { message: 'Document not found' });

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
    const vectorDb = c.get('db') ?? getRestClient();
    await assertWorkspaceAccess(vectorDb, c.get('user'), workspaceId);

    const readable = await readCondition(vectorDb, c.get('user')?.id);

    const [totalRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(and(eq(ragDocuments.workspaceId, workspaceId), readable));

    const [indexedRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.workspaceId, workspaceId),
          eq(ragDocuments.status, 'indexed'),
          readable,
        ),
      );

    const [pendingRow] = await vectorDb
      .select({ total: count() })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.workspaceId, workspaceId),
          eq(ragDocuments.status, 'pending'),
          readable,
        ),
      );

    const [lastRow] = await vectorDb
      .select({ lastIndexedAt: max(ragDocuments.indexedAt) })
      .from(ragDocuments)
      .where(
        and(eq(ragDocuments.workspaceId, workspaceId), isNotNull(ragDocuments.indexedAt), readable),
      );

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
