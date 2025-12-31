import { todoTable } from "../schema/todos";
import { type dbSqlite } from "../db";

export function insertTodo(db: ReturnType<typeof dbSqlite>, text: string) {
  return db.insert(todoTable).values({ text });
}

export function getAllTodos(db: ReturnType<typeof dbSqlite>) {
  return db.select().from(todoTable).all();
}
