import type { RevealAfterChangeHook } from '@revealui/core';
import type { Post } from '@revealui/core/types/admin';
import { getIndexer } from '@/lib/ai/indexer';
import { asRecord } from '@/lib/utils/type-guards';

export const indexPost: RevealAfterChangeHook<Post> = ({ doc, operation }) => {
  const op = operation as 'create' | 'update' | 'delete';

  // Fire-and-forget — do not block the response
  getIndexer()
    .then((indexer) => {
      if (!indexer) return;
      const record = asRecord(doc);
      return indexer.onDocumentChanged({
        collection: 'posts',
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
