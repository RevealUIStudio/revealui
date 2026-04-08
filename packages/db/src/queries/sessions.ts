/**
 * Session database queries with soft-delete support
 */

import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { sessions } from '../schema/users.js';

/** Active session condition: not expired and not soft-deleted */
const activeSession = (userId: string) => [
  eq(sessions.userId, userId),
  gt(sessions.expiresAt, new Date()),
  isNull(sessions.deletedAt),
];

/** List active (non-expired, non-revoked) sessions for a user */
export async function getActiveSessions(db: Database, userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      persistent: sessions.persistent,
      lastActivityAt: sessions.lastActivityAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(...activeSession(userId)))
    .orderBy(sessions.lastActivityAt);
}

/** Soft-delete (revoke) a session owned by a specific user */
export async function revokeSession(db: Database, sessionId: string, userId: string) {
  const result = await db
    .update(sessions)
    .set({ deletedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.deletedAt)))
    .returning();
  return result[0] ?? null;
}
