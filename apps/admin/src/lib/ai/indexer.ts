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

import { type DeploymentModeEnv, isHostedDeployment } from '@revealui/core/deployment-mode';
import { getClient, getRestClient } from '@revealui/db/client';

export const HOSTED_INDEX_EMBEDDING_REFUSAL =
  'Hosted deployments cannot embed documents with a deployment env model key. Configure a provider key for this account under /settings/api-keys.';

/**
 * Collection hooks have no per-request customer key on this singleton.
 * Hosted indexing fails closed. Forge still embeds with the deployment env client.
 */
export async function embedTextForIndex(
  text: string,
  generateEmbedding: (text: string) => Promise<{ vector: number[] }>,
  env: DeploymentModeEnv = process.env,
): Promise<number[]> {
  if (isHostedDeployment(env)) {
    throw new Error(HOSTED_INDEX_EMBEDDING_REFUSAL);
  }
  const result = await generateEmbedding(text);
  return result.vector;
}

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
  const embeddingFn = (text: string): Promise<number[]> =>
    embedTextForIndex(text, (value) => embeddingsMod.generateEmbedding(value));

  const pipeline = new ingestionMod.IngestionPipeline(db, restDb, embeddingFn);

  indexerInstance = new ingestionMod.AdminIndexer({
    ingestionPipeline: pipeline,
    enabledCollections: ['posts', 'pages'],
    defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID ?? 'default',
  });

  return indexerInstance;
}

export { getIndexer };
