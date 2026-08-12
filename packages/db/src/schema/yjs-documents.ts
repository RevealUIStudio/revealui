import { customType, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Collaborative Yjs document blobs.
 *
 * `owner_id` (GAP-477 residual): creating user for Electric shape ACL.
 * Null rows are legacy (pre-migration) and remain admin_platform-only on shapes.
 */
export const yjsDocuments = pgTable(
  'yjs_documents',
  {
    id: text('id').primaryKey(),
    state: bytea('state').notNull(),
    stateVector: bytea('state_vector'),
    /** Creating user id when known; null = legacy / unstamped (admin-only shapes). */
    ownerId: text('owner_id'),
    connectedClients: integer('connected_clients').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('yjs_documents_owner_id_idx').on(table.ownerId)],
);

export type YjsDocument = typeof yjsDocuments.$inferSelect;
export type NewYjsDocument = typeof yjsDocuments.$inferInsert;
