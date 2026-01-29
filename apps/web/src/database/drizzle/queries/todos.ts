import { todoTable } from '../schema/todos.js'

export function insertTodo(db: any, text: string) {
  return db.insert(todoTable).values({ text })
}

export function getAllTodos(db: any) {
  return db.select().from(todoTable).all()
}
