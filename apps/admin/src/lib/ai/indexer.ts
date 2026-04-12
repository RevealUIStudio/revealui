/**
 * admin RAG Indexer Singleton
 *
 * Creates a shared AdminIndexer + IngestionPipeline that collection afterChange
 * hooks can call without re-initialising the pipeline on every document save.
 *
 * Only initialised when first accessed so the module can be imported at the
 * top of any collection config without causing issues at build time.
 *
 * @revealui/ai is an optional Pro dependency  -  getIndexer() returns null
 * when the package is not installed.
 */

import { getClient, getRestClient } from '@revealui/db/client';

let indexerInstance: {
  onDocumentChanged: (event: {
    collection: string;
    id: string;
    operation: 'create' | 'update' | 'delete';
    doc?: Record<string, unknown>;
    workspaceId?: string;
  }) => Promise<void>;
} | null = null;

async function getIndexer(): Promise<typeof indexerInstance> {
  if (indexerInstance) return indexerInstance;

  const [embeddingsMod, ingestionMod] = await Promise.all([
    import('@revealui/ai/embeddings').catch(() => null),
    import('@revealui/ai/ingestion').catch(() => null),
  ]);

  if (!(embeddingsMod && ingestionMod)) return null;

  const db = getClient();
  const restDb = getRestClient();
  const embeddingFn = async (text: string): Promise<number[]> => {
    const result = await embeddingsMod.generateEmbedding(text);
    return result.vector;
  };

  const pipeline = new ingestionMod.IngestionPipeline(db, restDb, embeddingFn);

  indexerInstance = new ingestionMod.AdminIndexer({
    ingestionPipeline: pipeline,
    enabledCollections: ['posts', 'pages'],
    defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID ?? 'default',
  });

  return indexerInstance;
}

export { getIndexer };
