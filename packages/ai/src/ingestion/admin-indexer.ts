/**
 * admin Indexer
 *
 * Handles automatic re-indexing of admin documents when they change.
 * Wire into admin collection afterChange hooks  -  no admin API calls from here,
 * the pipeline reads the canonical site-backed page from the database.
 *
 * Usage (in apps/admin/src/lib/ai/indexer.ts):
 *   export const adminIndexer = new AdminIndexer({ ingestionPipeline, enabledCollections: ['pages'] })
 *
 * In each admin collection afterChange hook:
 *   await adminIndexer.onDocumentChanged({ collection: 'pages', id: doc.id, workspaceId: doc.siteId, operation, doc })
 */

import type { IngestionPipeline } from './pipeline.js';

export interface CmsDocumentEvent {
  collection: string;
  id: string;
  operation: 'create' | 'update' | 'delete';
  doc?: Record<string, unknown>;
  workspaceId?: string;
}

export interface AdminIndexerConfig {
  ingestionPipeline: IngestionPipeline;
  enabledCollections: string[];
}

export class AdminIndexer {
  private pipeline: IngestionPipeline;
  private enabledCollections: Set<string>;

  constructor(config: AdminIndexerConfig) {
    this.pipeline = config.ingestionPipeline;
    this.enabledCollections = new Set(config.enabledCollections);
  }

  /**
   * Handle an admin document change event.
   * Skips collections not in enabledCollections.
   */
  async onDocumentChanged(event: CmsDocumentEvent): Promise<void> {
    if (!this.enabledCollections.has(event.collection)) return;

    const workspaceId = event.workspaceId;
    if (!workspaceId) throw new Error('CMS indexing requires an explicit site workspace');
    const sourceId = String(event.id);
    const sourceCollection = event.collection;

    if (event.operation === 'delete') {
      await this.pipeline.deleteBySource(workspaceId, sourceCollection, sourceId);
      return;
    }

    if (!event.doc) return;

    // For create/update: remove existing chunks, then re-ingest
    await this.pipeline.deleteBySource(workspaceId, sourceCollection, sourceId);

    await this.pipeline.ingest({
      workspaceId,
      sourceType: 'admin_collection',
      sourceCollection,
      sourceId,
      mimeType: 'text/plain',
      rawContent: '', // The pipeline reads the canonical page, not event content.
    });
  }
}
