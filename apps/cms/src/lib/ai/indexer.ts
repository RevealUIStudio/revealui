/**
 * CMS RAG Indexer Singleton
 *
 * Creates a shared CmsIndexer + IngestionPipeline that collection afterChange
 * hooks can call without re-initialising the pipeline on every document save.
 *
 * Only initialised when first accessed so the module can be imported at the
 * top of any collection config without causing issues at build time.
 */

import { generateEmbedding } from '@revealui/ai/embeddings'
import { CmsIndexer, IngestionPipeline } from '@revealui/ai/ingestion'
import { getRestClient } from '@revealui/db/client'

let indexerInstance: CmsIndexer | null = null

function getIndexer(): CmsIndexer {
  if (indexerInstance) return indexerInstance

  const db = getRestClient()
  const embeddingFn = async (text: string): Promise<number[]> => {
    const result = await generateEmbedding(text)
    return result.vector
  }

  const pipeline = new IngestionPipeline(db, embeddingFn)

  indexerInstance = new CmsIndexer({
    ingestionPipeline: pipeline,
    enabledCollections: ['posts', 'pages'],
    defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID ?? 'default',
  })

  return indexerInstance
}

export { getIndexer }
