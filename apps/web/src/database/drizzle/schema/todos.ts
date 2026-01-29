import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

// Example of defining a schema in Drizzle ORM (PostgreSQL/PGlite):
export const todoTable = pgTable('todos', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
})

// You can then infer the types for selecting and inserting
export type TodoItem = typeof todoTable.$inferSelect
export type TodoInsert = typeof todoTable.$inferInsert
