/**
 * Todo database queries
 */

import { eq } from 'drizzle-orm'
import type { DatabaseClient } from '../client/types.js'
import { todos } from '../schema/todos.js'

export async function getAllTodos(db: DatabaseClient) {
  return db.select().from(todos).orderBy(todos.createdAt)
}

export async function getTodoById(db: DatabaseClient, id: string) {
  const result = await db.select().from(todos).where(eq(todos.id, id)).limit(1)
  return result[0] ?? null
}

export async function createTodo(db: DatabaseClient, text: string) {
  const result = await db
    .insert(todos)
    .values({
      text,
      completed: false,
    })
    .returning()

  return result[0]
}

export async function updateTodo(
  db: DatabaseClient,
  id: string,
  data: { text?: string; completed?: boolean },
) {
  const result = await db
    .update(todos)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(todos.id, id))
    .returning()

  return result[0] ?? null
}

export async function deleteTodo(db: DatabaseClient, id: string) {
  await db.delete(todos).where(eq(todos.id, id))
}
