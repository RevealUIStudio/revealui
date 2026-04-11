import { customType, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const yjsDocuments = pgTable('yjs_documents', {
  id: text('id').primaryKey(),
  state: bytea('state').notNull(),
  stateVector: bytea('state_vector'),
  connectedClients: integer('connected_clients').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

export type YjsDocument = typeof yjsDocuments.$inferSelect;
export type NewYjsDocument = typeof yjsDocuments.$inferInsert;
