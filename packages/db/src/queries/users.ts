/**
 * User database queries with soft-delete support
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '../client/types.js';
import { users } from '../schema/users.js';

/** Condition that excludes soft-deleted users */
const notDeleted = isNull(users.deletedAt);

export async function getUserById(db: DatabaseClient, id: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(db: DatabaseClient, email: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

/** Soft-delete: sets deletedAt timestamp instead of removing the row */
export async function deleteUser(db: DatabaseClient, id: string) {
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date(), status: 'deleted' })
    .where(and(eq(users.id, id), notDeleted));
}

/** Restore a soft-deleted user */
export async function restoreUser(db: DatabaseClient, id: string) {
  const result = await db
    .update(users)
    .set({ deletedAt: null, updatedAt: new Date(), status: 'active' })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
}

/** Permanently remove a soft-deleted user (GDPR compliance / admin cleanup) */
export async function purgeUser(db: DatabaseClient, id: string) {
  await db.delete(users).where(eq(users.id, id));
}
