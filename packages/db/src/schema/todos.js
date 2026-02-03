/**
 * Todos Schema - Simple demo table for API integration
 */
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
//# sourceMappingURL=todos.js.map
