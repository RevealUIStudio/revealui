/**
 * CMS Indexer
 *
 * Handles automatic re-indexing of CMS documents when they change.
 * Wire into CMS collection afterChange hooks — no CMS API calls from here,
 * the event payload carries the document content directly.
 *
 * Usage (in apps/admin/src/lib/ai/indexer.ts):
 *   export const cmsIndexer = new CmsIndexer({ db, ingestionPipeline, enabledCollections: ['posts', 'pages'] })
 *
 * In each CMS collection afterChange hook:
 *   await cmsIndexer.onDocumentChanged({ collection: 'posts', id: doc.id, operation, doc })
 */

import type { IngestionPipeline } from './pipeline.js';

export interface CmsDocumentEvent {
  collection: string;
  id: string;
  operation: 'create' | 'update' | 'delete';
  doc?: Record<string, unknown>;
  workspaceId?: string;
}

export interface CmsIndexerConfig {
  ingestionPipeline: IngestionPipeline;
  enabledCollections: string[];
  /** Default workspaceId when not provided per-event */
  defaultWorkspaceId?: string;
}

function extractText(doc: Record<string, unknown>): string {
  // Prefer explicit content/rawContent fields, then JSON fallback
  if (typeof doc.content === 'string') return doc.content;
  if (typeof doc.rawContent === 'string') return doc.rawContent;
  if (typeof doc.description === 'string') return doc.description;
  if (typeof doc.body === 'string') return doc.body;

  // Strip internal metadata fields before JSON serialization
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = doc;
  return JSON.stringify(rest, null, 2);
}

function extractTitle(doc: Record<string, unknown>): string | undefined {
  if (typeof doc.title === 'string') return doc.title;
  if (typeof doc.name === 'string') return doc.name;
  return undefined;
}

export class CmsIndexer {
  private pipeline: IngestionPipeline;
  private enabledCollections: Set<string>;
  private defaultWorkspaceId: string;

  constructor(config: CmsIndexerConfig) {
    this.pipeline = config.ingestionPipeline;
    this.enabledCollections = new Set(config.enabledCollections);
    this.defaultWorkspaceId = config.defaultWorkspaceId ?? 'default';
  }

  /**
   * Handle a CMS document change event.
   * Skips collections not in enabledCollections.
   */
  async onDocumentChanged(event: CmsDocumentEvent): Promise<void> {
    if (!this.enabledCollections.has(event.collection)) return;

    const workspaceId = event.workspaceId ?? this.defaultWorkspaceId;
    const sourceId = String(event.id);
    const sourceCollection = event.collection;

    if (event.operation === 'delete') {
      await this.pipeline.deleteBySource(workspaceId, sourceCollection, sourceId);
      return;
    }

    if (!event.doc) return;

    // For create/update: remove existing chunks, then re-ingest
    await this.pipeline.deleteBySource(workspaceId, sourceCollection, sourceId);

    const rawContent = extractText(event.doc);
    const title = extractTitle(event.doc);

    await this.pipeline.ingest({
      workspaceId,
      sourceType: 'cms_collection',
      sourceCollection,
      sourceId,
      title,
      mimeType: 'text/plain',
      rawContent,
    });
  }
}
