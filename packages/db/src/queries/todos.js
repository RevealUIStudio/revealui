/**
 * Todo database queries
 */
import { eq } from 'drizzle-orm';
import { todos } from '../schema/todos.js';
export async function getAllTodos(db) {
    return db.select().from(todos).orderBy(todos.createdAt);
}
export async function getTodoById(db, id) {
    const result = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
    return result[0] ?? null;
}
export async function createTodo(db, text) {
    const result = await db
        .insert(todos)
        .values({
        text,
        completed: false,
    })
        .returning();
    return result[0];
}
export async function updateTodo(db, id, data) {
    const result = await db
        .update(todos)
        .set({
        ...data,
        updatedAt: new Date(),
    })
        .where(eq(todos.id, id))
        .returning();
    return result[0] ?? null;
}
export async function deleteTodo(db, id) {
    await db.delete(todos).where(eq(todos.id, id));
}
//# sourceMappingURL=todos.js.map