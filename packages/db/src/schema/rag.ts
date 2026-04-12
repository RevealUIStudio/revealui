/**
 * RAG (Retrieval-Augmented Generation) Tables
 *
 * Stored on Supabase (vector database) because rag_chunks uses pgvector.
 * The ragDocuments → ragChunks FK cascade is enforced within Supabase.
 * The workspaceId → sites.id reference is cross-database (type-only, not enforced at runtime).
 *
 * Embedding dimensions: 768 (nomic-embed-text via Ollama  -  policy default)
 */

import { customType, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sites } from './sites.js';

// =============================================================================
// Custom Vector Type (768-dim for nomic-embed-text)
// =============================================================================

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions: number })?.dimensions ?? 768})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

// =============================================================================
// rag_documents  -  one row per indexed source
// =============================================================================

export const ragDocuments = pgTable('rag_documents', {
  id: text('id').primaryKey(),

  /** Which workspace (site) this document belongs to */
  workspaceId: text('workspace_id').references(() => sites.id, { onDelete: 'cascade' }),

  /** Source type: cms_collection, url, file, text */
  sourceType: text('source_type').notNull(),

  /** Source-specific identifier (e.g. admin document ID, URL, file path) */
  sourceId: text('source_id'),

  /** admin collection name when sourceType = 'cms_collection' */
  sourceCollection: text('source_collection'),

  title: text('title'),
  mimeType: text('mime_type').default('text/plain'),
  rawContent: text('raw_content'),
  wordCount: integer('word_count').default(0),
  tokenEstimate: integer('token_estimate').default(0),

  /** pending | processing | indexed | failed */
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  indexedAt: timestamp('indexed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

// =============================================================================
// rag_chunks  -  one row per text chunk, with 768-dim embedding
// =============================================================================

export const ragChunks = pgTable(
  'rag_chunks',
  {
    id: text('id').primaryKey(),

    documentId: text('document_id')
      .notNull()
      .references(() => ragDocuments.id, { onDelete: 'cascade' }),

    workspaceId: text('workspace_id').references(() => sites.id, { onDelete: 'cascade' }),

    content: text('content').notNull(),
    tokenCount: integer('token_count').default(0),
    chunkIndex: integer('chunk_index').notNull().default(0),

    /** Vector embedding  -  768 dimensions (nomic-embed-text) */
    embedding: vector('embedding', { dimensions: 768 }),
    embeddingModel: text('embedding_model'),

    /** Arbitrary metadata (e.g. page number, section heading) */
    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('rag_chunks_document_id_idx').on(table.documentId),
    index('rag_chunks_workspace_id_idx').on(table.workspaceId),
  ],
);

// =============================================================================
// rag_workspaces  -  per-workspace RAG configuration
// =============================================================================

export const ragWorkspaces = pgTable('rag_workspaces', {
  /** Same ID as the site/workspace */
  id: text('id').primaryKey(),

  name: text('name').notNull(),
  embeddingModel: text('embedding_model').notNull().default('nomic-embed-text'),
  chunkSize: integer('chunk_size').notNull().default(512),
  chunkOverlap: integer('chunk_overlap').notNull().default(64),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Type exports
// =============================================================================

export type RagDocument = typeof ragDocuments.$inferSelect;
export type NewRagDocument = typeof ragDocuments.$inferInsert;
export type RagChunk = typeof ragChunks.$inferSelect;
export type NewRagChunk = typeof ragChunks.$inferInsert;
export type RagWorkspace = typeof ragWorkspaces.$inferSelect;
export type NewRagWorkspace = typeof ragWorkspaces.$inferInsert;
