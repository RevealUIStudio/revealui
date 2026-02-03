/**
 * Todo database queries
 */
import type { DatabaseClient } from '../client/index.js'
export declare function getAllTodos(db: DatabaseClient): Promise<
  {
    id: string
    text: string
    completed: boolean
    createdAt: Date
    updatedAt: Date
  }[]
>
export declare function getTodoById(
  db: DatabaseClient,
  id: string,
): Promise<{
  id: string
  text: string
  completed: boolean
  createdAt: Date
  updatedAt: Date
}>
export declare function createTodo(
  db: DatabaseClient,
  text: string,
): Promise<{
  text: string
  id: string
  createdAt: Date
  updatedAt: Date
  completed: boolean
}>
export declare function updateTodo(
  db: DatabaseClient,
  id: string,
  data: {
    text?: string
    completed?: boolean
  },
): Promise<{
  id: string
  text: string
  completed: boolean
  createdAt: Date
  updatedAt: Date
}>
export declare function deleteTodo(db: DatabaseClient, id: string): Promise<void>
//# sourceMappingURL=todos.d.ts.map
