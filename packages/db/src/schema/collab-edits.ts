import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { yjsDocuments } from './yjs-documents.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const collabEdits = pgTable(
  'collab_edits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: text('document_id')
      .notNull()
      .references(() => yjsDocuments.id, { onDelete: 'cascade' }),
    clientType: text('client_type').notNull(),
    clientId: text('client_id').notNull(),
    clientName: text('client_name').notNull(),
    agentModel: text('agent_model'),
    updateData: bytea('update_data').notNull(),
    updateSize: integer('update_size').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('collab_edits_document_id_idx').on(table.documentId)],
);

export type CollabEdit = typeof collabEdits.$inferSelect;
export type NewCollabEdit = typeof collabEdits.$inferInsert;
