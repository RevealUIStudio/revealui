/**
 * Session Cleanup Integration Tests
 *
 * PURPOSE: Verify session expiration and cleanup mechanisms work correctly
 *
 * CRITICAL CONTEXT: Sessions must expire correctly to prevent:
 * - Session fixation attacks
 * - Stale sessions consuming database storage
 * - Inactive accounts remaining accessible
 *
 * TESTS:
 * - Session expiration timing (1 day regular, 7 days persistent)
 * - Expired sessions are not returned by getSession
 * - Session cleanup mechanism (manual and automated)
 * - Last activity tracking
 * - Bulk session deletion
 */

import { getClient } from '@revealui/db/client';
import { sessions, users } from '@revealui/db/schema';
import { and, eq, lt } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  deleteAllUserSessions,
  getSession,
} from '../../../../auth/src/server/session.js';
import { hashToken } from '../../../../auth/src/utils/token.js';
import { generateUniqueTestEmail, trackTestData } from '../../utils/integration-helpers.js';

describe('Session Cleanup Integration Tests', () => {
  let db: ReturnType<typeof getClient>;
  let testUserId: string;

  beforeAll(async () => {
    db = getClient();

    // Create test user
    const email = generateUniqueTestEmail('session-cleanup');
    const result = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: 'Test User',
        email,
        password: 'hashed_password_placeholder',
      })
      .returning();

    testUserId = result[0]?.id;
    trackTestData('users', testUserId);
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await db.delete(sessions).where(eq(sessions.userId, testUserId));
  });

  // =============================================================================
  // Session Expiration Timing
  // =============================================================================

  describe('Session Expiration Timing', () => {
    it('should create regular session with 1 day expiration', async () => {
      const { session } = await createSession(testUserId, { persistent: false });
      trackTestData('sessions', session.id);

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThan(23); // At least 23 hours
      expect(diffHours).toBeLessThan(25); // Less than 25 hours
      expect(session.persistent).toBe(false);
    });

    it('should create persistent session with 7 day expiration', async () => {
      const { session } = await createSession(testUserId, { persistent: true });
      trackTestData('sessions', session.id);

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThan(6.9); // At least 6.9 days
      expect(diffDays).toBeLessThan(7.1); // Less than 7.1 days
      expect(session.persistent).toBe(true);
    });

    it('should default to non-persistent session', async () => {
      const { session } = await createSession(testUserId);
      trackTestData('sessions', session.id);

      expect(session.persistent).toBe(false);

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(diffHours).toBeLessThan(25); // Should be 1 day (24 hours)
    });
  });

  // =============================================================================
  // Expired Session Handling
  // =============================================================================

  describe('Expired Session Handling', () => {
    it('should NOT return expired session', async () => {
      // Create session with past expiration
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const tokenHash = hashToken('test_token_123');

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        tokenHash,
        expiresAt: expiredDate,
        persistent: false,
        lastActivityAt: new Date(),
      });

      // Try to get session using cookie header
      const headers = new Headers();
      headers.set('cookie', 'revealui-session=test_token_123');

      const sessionData = await getSession(headers);

      expect(sessionData).toBeNull();
    });

    it('should return valid session before expiration', async () => {
      const { token, session: createdSession } = await createSession(testUserId);
      trackTestData('sessions', createdSession.id);

      const headers = new Headers();
      headers.set('cookie', `revealui-session=${token}`);

      const sessionData = await getSession(headers);

      expect(sessionData).not.toBeNull();
      expect(sessionData?.session.id).toBe(createdSession.id);
      expect(sessionData?.user.id).toBe(testUserId);
    });

    it('should not return session exactly at expiration time', async () => {
      // Create session expiring exactly now
      const now = new Date();
      const tokenHash = hashToken('test_token_456');

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        tokenHash,
        expiresAt: now,
        persistent: false,
        lastActivityAt: new Date(),
      });

      // Small delay to ensure we're past expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      const headers = new Headers();
      headers.set('cookie', 'revealui-session=test_token_456');

      const sessionData = await getSession(headers);

      expect(sessionData).toBeNull();
    });
  });

  // =============================================================================
  // Manual Session Cleanup
  // =============================================================================

  describe('Manual Session Cleanup', () => {
    it('should delete all expired sessions for cleanup', async () => {
      // Create multiple expired sessions
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // 2 days ago

      for (let i = 0; i < 5; i++) {
        await db.insert(sessions).values({
          id: crypto.randomUUID(),
          userId: testUserId,
          tokenHash: hashToken(`expired_token_${i}`),
          expiresAt: expiredDate,
          persistent: false,
          lastActivityAt: new Date(),
        });
      }

      // Create one valid session
      const { session: validSession } = await createSession(testUserId);
      trackTestData('sessions', validSession.id);

      // Manual cleanup: delete expired sessions
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, testUserId), lt(sessions.expiresAt, new Date())));

      // Check remaining sessions
      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));

      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0]?.id).toBe(validSession.id);
    });

    it('should cleanup expired sessions across all users', async () => {
      // Create second test user
      const email2 = generateUniqueTestEmail('cleanup-user-2');
      const user2Result = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: 'Test User 2',
          email: email2,
          password: 'hashed_password',
        })
        .returning();

      const userId2 = user2Result[0]?.id;
      trackTestData('users', userId2);

      // Create expired sessions for both users
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        tokenHash: hashToken('user1_expired'),
        expiresAt: expiredDate,
        persistent: false,
        lastActivityAt: new Date(),
      });

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: userId2,
        tokenHash: hashToken('user2_expired'),
        expiresAt: expiredDate,
        persistent: false,
        lastActivityAt: new Date(),
      });

      // Create valid sessions
      const { session: validSession1 } = await createSession(testUserId);
      trackTestData('sessions', validSession1.id);

      const { session: validSession2 } = await createSession(userId2);
      trackTestData('sessions', validSession2.id);

      // Global cleanup: delete all expired sessions
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

      // Check remaining sessions
      const allSessions = await db.select().from(sessions);

      expect(allSessions).toHaveLength(2);
      expect(allSessions.map((s) => s.id)).toContain(validSession1.id);
      expect(allSessions.map((s) => s.id)).toContain(validSession2.id);
    });
  });

  // =============================================================================
  // Last Activity Tracking
  // =============================================================================

  describe('Last Activity Tracking', () => {
    it('should update lastActivityAt on session retrieval', async () => {
      const { token, session: createdSession } = await createSession(testUserId);
      trackTestData('sessions', createdSession.id);

      const initialLastActivity = new Date(createdSession.lastActivityAt);

      // Wait 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Retrieve session (should update lastActivityAt)
      const headers = new Headers();
      headers.set('cookie', `revealui-session=${token}`);

      await getSession(headers);

      // Check lastActivityAt was updated
      const updatedSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, createdSession.id));

      const updatedLastActivity = new Date(updatedSessions[0]?.lastActivityAt);

      expect(updatedLastActivity.getTime()).toBeGreaterThan(initialLastActivity.getTime());
    });

    it('should track activity for inactive session cleanup', async () => {
      // Create session with old lastActivityAt
      const oldActivityDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30 days ago
      const tokenHash = hashToken('inactive_token');

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // Valid for 1 day
        persistent: false,
        lastActivityAt: oldActivityDate,
      });

      // Create recent session
      const { session: activeSession } = await createSession(testUserId);
      trackTestData('sessions', activeSession.id);

      // Cleanup sessions with no activity in last 30 days (even if not expired)
      const inactivityThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
      await db
        .delete(sessions)
        .where(
          and(eq(sessions.userId, testUserId), lt(sessions.lastActivityAt, inactivityThreshold)),
        );

      // Check remaining sessions
      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));

      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0]?.id).toBe(activeSession.id);
    });
  });

  // =============================================================================
  // Bulk Session Deletion
  // =============================================================================

  describe('Bulk Session Deletion', () => {
    it('should delete all sessions for a user', async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const { session } = await createSession(testUserId);
        trackTestData('sessions', session.id);
      }

      // Verify sessions exist
      const beforeSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(beforeSessions).toHaveLength(3);

      // Delete all user sessions
      await deleteAllUserSessions(testUserId);

      // Verify all sessions deleted
      const afterSessions = await db.select().from(sessions).where(eq(sessions.userId, testUserId));
      expect(afterSessions).toHaveLength(0);
    });

    it('should only delete sessions for specific user', async () => {
      // Create second user
      const email2 = generateUniqueTestEmail('other-user');
      const user2Result = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: 'Other User',
          email: email2,
          password: 'hashed_password',
        })
        .returning();

      const userId2 = user2Result[0]?.id;
      trackTestData('users', userId2);

      // Create sessions for both users
      const { session: session1 } = await createSession(testUserId);
      trackTestData('sessions', session1.id);

      const { session: session2 } = await createSession(userId2);
      trackTestData('sessions', session2.id);

      // Delete only first user's sessions
      await deleteAllUserSessions(testUserId);

      // Verify only first user's sessions deleted
      const user1Sessions = await db.select().from(sessions).where(eq(sessions.userId, testUserId));
      const user2Sessions = await db.select().from(sessions).where(eq(sessions.userId, userId2));

      expect(user1Sessions).toHaveLength(0);
      expect(user2Sessions).toHaveLength(1);
    });
  });

  // =============================================================================
  // Session Metadata
  // =============================================================================

  describe('Session Metadata', () => {
    it('should store userAgent and ipAddress', async () => {
      const { session } = await createSession(testUserId, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '192.168.1.100',
      });

      trackTestData('sessions', session.id);

      expect(session.userAgent).toBe(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      );
      expect(session.ipAddress).toBe('192.168.1.100');
    });

    it('should allow missing userAgent and ipAddress', async () => {
      const { session } = await createSession(testUserId);
      trackTestData('sessions', session.id);

      expect(session.userAgent).toBeNull();
      expect(session.ipAddress).toBeNull();
    });

    it('should enable session auditing by IP and user agent', async () => {
      // Create sessions from different IPs
      const { session: session1 } = await createSession(testUserId, {
        ipAddress: '192.168.1.100',
        userAgent: 'Chrome',
      });
      trackTestData('sessions', session1.id);

      const { session: session2 } = await createSession(testUserId, {
        ipAddress: '10.0.0.50',
        userAgent: 'Firefox',
      });
      trackTestData('sessions', session2.id);

      // Query sessions by IP
      const chromeSessions = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, testUserId), eq(sessions.ipAddress, '192.168.1.100')));

      expect(chromeSessions).toHaveLength(1);
      expect(chromeSessions[0]?.userAgent).toBe('Chrome');
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle cleanup when no expired sessions exist', async () => {
      const { session } = await createSession(testUserId);
      trackTestData('sessions', session.id);

      // Attempt cleanup
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, testUserId), lt(sessions.expiresAt, new Date())));

      // Verify valid session still exists
      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));

      expect(remainingSessions).toHaveLength(1);
    });

    it('should handle cleanup when all sessions are expired', async () => {
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

      for (let i = 0; i < 3; i++) {
        await db.insert(sessions).values({
          id: crypto.randomUUID(),
          userId: testUserId,
          tokenHash: hashToken(`expired_${i}`),
          expiresAt: expiredDate,
          persistent: false,
          lastActivityAt: new Date(),
        });
      }

      // Cleanup all expired
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, testUserId), lt(sessions.expiresAt, new Date())));

      // Verify all deleted
      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));

      expect(remainingSessions).toHaveLength(0);
    });

    it('should handle very old sessions (> 1 year)', async () => {
      const veryOldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365); // 1 year ago
      const tokenHash = hashToken('very_old_token');

      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        userId: testUserId,
        tokenHash,
        expiresAt: veryOldDate,
        persistent: false,
        lastActivityAt: veryOldDate,
      });

      // Cleanup
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, testUserId), lt(sessions.expiresAt, new Date())));

      const remainingSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));

      expect(remainingSessions).toHaveLength(0);
    });
  });
});
