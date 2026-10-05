import type { RevealAfterChangeHook } from '@revealui/core';
import type { Page } from '@revealui/core/types/admin';
import { getIndexer } from '@/lib/ai/indexer';
import { asRecord } from '@/lib/utils/type-guards';

export const indexPage: RevealAfterChangeHook<Page> = ({ doc, operation }) => {
  const op = operation as 'create' | 'update' | 'delete';

  // Fire-and-forget  -  do not block the response
  getIndexer()
    .then((indexer) => {
      if (!indexer) return;
      const record = asRecord(doc);
      if (typeof record.siteId !== 'string' || record.siteId.length === 0) {
        throw new Error('Page indexing requires its canonical siteId');
      }
      return indexer.onDocumentChanged({
        collection: 'pages',
        id: String(record.id),
        operation: op,
        doc: record,
        workspaceId: record.siteId,
      });
    })
    .catch(() => {
      // Indexing errors must never break the save operation
    });

  return doc;
};
