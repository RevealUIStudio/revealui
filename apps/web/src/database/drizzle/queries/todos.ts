import type { dbSqlite } from '../db.js'
import { todoTable } from '../schema/todos.js'

type Database = ReturnType<typeof dbSqlite>

export function insertTodo(db: Database, text: string) {
  return db.insert(todoTable).values({ text })
}

export function getAllTodos(db: Database) {
  return db.select().from(todoTable).all()
}
