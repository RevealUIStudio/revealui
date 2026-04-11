import { jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(),
    schemaVersion: text('schema_version').notNull().default('1'),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password'),
    roles: jsonb('roles').$type<string[]>().default([]).notNull(),
    domains: jsonb('domains').$type<Array<{ domain: string }>>().default([]).notNull(),
    _json: jsonb('_json').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('tenants_email_idx').on(table.email)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
