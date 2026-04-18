/**
 * Yjs Document Patches table - Structured patches for CLI agent scratchpad edits.
 *
 * CLI agents cannot run WebSocket Yjs connections. Instead they submit structured
 * patches (append section, add item, replace section, set key) which are applied
 * server-side to the Yjs document state. Electric fans out the updated state to
 * all browser subscribers.
 *
 * Layer 2 of the multi-agent shared memory architecture.
 */

import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { yjsDocuments } from './yjs-documents.js';

// =============================================================================
// Yjs Document Patches Table
// =============================================================================

export const yjsDocumentPatches = pgTable(
  'yjs_document_patches',
  {
    id: serial('id').primaryKey(),

    // Which document this patch applies to
    documentId: text('document_id')
      .notNull()
      .references(() => yjsDocuments.id, { onDelete: 'cascade' }),

    // Agent that submitted this patch
    agentId: text('agent_id').notNull(),

    // Type of structured edit
    patchType: text('patch_type').notNull(),

    // Target path in the document (e.g. "findings" or "plan.phase1")
    path: text('path').notNull(),

    // Content to insert/replace
    content: text('content').notNull(),

    // Whether this patch has been applied to the Yjs document state
    applied: boolean('applied').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('yjs_document_patches_doc_applied_idx').on(table.documentId, table.applied),
    index('yjs_document_patches_created_at_idx').on(table.createdAt),
    check(
      'yjs_document_patches_type_check',
      sql`patch_type IN ('append_section', 'append_item', 'replace_section', 'set_key')`,
    ),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type YjsDocumentPatch = typeof yjsDocumentPatches.$inferSelect;
export type NewYjsDocumentPatch = typeof yjsDocumentPatches.$inferInsert;
