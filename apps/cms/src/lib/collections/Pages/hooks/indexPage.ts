import type { CmsDocumentEvent } from '@revealui/ai/ingestion'
import type { RevealAfterChangeHook } from '@revealui/core'
import type { Page } from '@revealui/core/types/cms'
import { getIndexer } from '@/lib/ai/indexer'

export const indexPage: RevealAfterChangeHook<Page> = ({ doc, operation }) => {
  const op = operation as CmsDocumentEvent['operation']

  // Fire-and-forget — do not block the response
  getIndexer()
    .onDocumentChanged({
      collection: 'pages',
      id: String((doc as unknown as Record<string, unknown>).id),
      operation: op,
      doc: doc as unknown as Record<string, unknown>,
    })
    .catch(() => {
      // Indexing errors must never break the save operation
    })

  return doc
}
