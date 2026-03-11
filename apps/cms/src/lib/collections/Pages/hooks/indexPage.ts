import type { RevealAfterChangeHook } from '@revealui/core';
import type { Page } from '@revealui/core/types/cms';
import { getIndexer } from '@/lib/ai/indexer';

export const indexPage: RevealAfterChangeHook<Page> = ({ doc, operation }) => {
  const op = operation as 'create' | 'update' | 'delete';

  // Fire-and-forget — do not block the response
  getIndexer()
    .then((indexer) => {
      if (!indexer) return;
      return indexer.onDocumentChanged({
        collection: 'pages',
        id: String((doc as unknown as Record<string, unknown>).id),
        operation: op,
        doc: doc as unknown as Record<string, unknown>,
      });
    })
    .catch(() => {
      // Indexing errors must never break the save operation
    });

  return doc;
};
