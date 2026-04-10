/**
 * User database queries with soft-delete support
 */

import { and, count, desc, eq, gt, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { users } from '../schema/users.js';

/** Condition that excludes soft-deleted users */
const notDeleted = isNull(users.deletedAt);

export interface ListUsersOptions {
  status?: string;
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** List users with optional filters and pagination */
export async function getAllUsers(db: Database, options: ListUsersOptions = {}) {
  const { status, role, search, limit = 20, offset = 0 } = options;
  const conditions = [
    notDeleted,
    ...(status ? [eq(users.status, status)] : []),
    ...(role ? [eq(users.role, role)] : []),
    ...(search ? [ilike(users.email, `%${search}%`)] : []),
  ];
  return db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Count users matching filters (for pagination) */
export async function countUsers(db: Database, options: ListUsersOptions = {}) {
  const { status, role, search } = options;
  const conditions = [
    notDeleted,
    ...(status ? [eq(users.status, status)] : []),
    ...(role ? [eq(users.role, role)] : []),
    ...(search ? [ilike(users.email, `%${search}%`)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(users)
    .where(and(...conditions));
  return result[0]?.total ?? 0;
}

/** Update a user's fields */
export async function updateUser(
  db: Database,
  id: string,
  data: Partial<typeof users.$inferInsert>,
) {
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(users.id, id), notDeleted))
    .returning();
  return result[0] ?? null;
}

/** Batch-load multiple users by ID in a single query (prevents N+1) */
export async function getUsersByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(users)
    .where(and(inArray(users.id, ids), notDeleted));
}

export async function getUserById(db: Database, id: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(db: Database, email: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

/** Soft-delete: sets deletedAt timestamp instead of removing the row */
export async function deleteUser(db: Database, id: string) {
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date(), status: 'deleted' })
    .where(and(eq(users.id, id), notDeleted));
}

/** Restore a soft-deleted user */
export async function restoreUser(db: Database, id: string) {
  const result = await db
    .update(users)
    .set({ deletedAt: null, updatedAt: new Date(), status: 'active' })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
}

/** Create a new user and return the inserted row */
export async function createUser(db: Database, data: typeof users.$inferInsert) {
  const result = await db.insert(users).values(data).returning();
  return result[0] ?? null;
}

/** Anonymize PII for GDPR right-to-erasure. Soft-deletes if not already deleted. */
export async function anonymizeUser(db: Database, id: string) {
  const now = new Date();
  const result = await db
    .update(users)
    .set({
      name: 'Deleted User',
      email: null,
      avatarUrl: null,
      password: null,
      mfaSecret: null,
      mfaBackupCodes: null,
      sshKeyFingerprint: null,
      preferences: null,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
      agentConfig: null,
      anonymizedAt: now,
      deletedAt: now,
      updatedAt: now,
      status: 'deleted',
    })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
}

/** Permanently remove a soft-deleted user (GDPR compliance / admin cleanup) */
export async function purgeUser(db: Database, id: string) {
  await db.delete(users).where(eq(users.id, id));
}

/** Count active (non-deleted, status='active') users */
export async function countActiveUsers(db: Database): Promise<number> {
  const result = await db.select({ total: count() }).from(users).where(eq(users.status, 'active'));
  return result[0]?.total ?? 0;
}

/** Look up a user by their email verification token hash (non-expired only) */
export async function getUserByVerificationToken(db: Database, tokenHash: string) {
  const result = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(
      and(
        eq(users.emailVerificationToken, tokenHash),
        or(
          isNull(users.emailVerificationTokenExpiresAt),
          gt(users.emailVerificationTokenExpiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}
