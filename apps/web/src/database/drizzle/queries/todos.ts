import type { dbSqlite } from "../db";
import { todoTable } from "../schema/todos";

export function insertTodo(db: ReturnType<typeof dbSqlite>, text: string) {
	return db.insert(todoTable).values({ text });
}

export function getAllTodos(db: ReturnType<typeof dbSqlite>) {
	return db.select().from(todoTable).all();
}
