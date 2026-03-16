import type { RevealAfterChangeHook } from '@revealui/core';
import type { Page } from '@revealui/core/types/cms';
import { getIndexer } from '@/lib/ai/indexer';
import { asRecord } from '@/lib/utils/type-guards';

export const indexPage: RevealAfterChangeHook<Page> = ({ doc, operation }) => {
  const op = operation as 'create' | 'update' | 'delete';

  // Fire-and-forget — do not block the response
  getIndexer()
    .then((indexer) => {
      if (!indexer) return;
      const record = asRecord(doc);
      return indexer.onDocumentChanged({
        collection: 'pages',
        id: String(record.id),
        operation: op,
        doc: record,
      });
    })
    .catch(() => {
      // Indexing errors must never break the save operation
    });

  return doc;
};
