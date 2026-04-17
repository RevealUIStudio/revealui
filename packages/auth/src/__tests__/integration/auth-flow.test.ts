/**
 * Authentication Flow Integration Tests
 *
 * Integration tests for complete authentication flows.
 * These tests require a database connection.
 */

import { getClient } from '@revealui/db/client';
import { sessions, users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signIn, signUp } from '../../server/auth.js';
import { deleteSession, getSession } from '../../server/session.js';

// Skip integration tests in unit test mode
// Integration tests need TEST_DATABASE_URL explicitly set with migrations run
// Don't use DATABASE_URL or POSTGRES_URL which may be for development/production
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isTestMode = process.env.NODE_ENV === 'test';

describe.skipIf(!testDatabaseUrl || isTestMode)('Authentication Flow Integration', () => {
  let testUserId: string;
  let testEmail: string;
  let testPassword: string;

  // Verify database is configured before running tests
  beforeAll(async () => {
    process.env.REVEALUI_SIGNUP_OPEN = 'true';
    // Generate test credentials
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = 'TestPassword123!';
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      const db = getClient();
      await db.delete(sessions).where(eq(sessions.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('Sign Up Flow', () => {
    it('should create a new user and session', async () => {
      const result = await signUp(testEmail, testPassword, 'Test User', {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(testEmail);
      expect(result.sessionToken).toBeDefined();

      testUserId = result.user?.id;
    });

    it('should fail if email already exists', async () => {
      const result = await signUp(testEmail, testPassword, 'Another User');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('Sign In Flow', () => {
    it('should sign in with correct credentials', async () => {
      const result = await signIn(testEmail, testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(testEmail);
      expect(result.sessionToken).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      const result = await signIn(testEmail, 'WrongPassword', {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should fail with non-existent email', async () => {
      const result = await signIn('nonexistent@example.com', testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('Session Management', () => {
    it('should get session from headers', async () => {
      // Create a session for testing
      const result = await signIn(testEmail, testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBeDefined();

      const sessionToken = result.sessionToken;
      if (!sessionToken) {
        throw new Error('Session token should be defined');
      }
      const headers = new Headers();
      headers.set('cookie', `revealui-session=${sessionToken}`);

      const session = await getSession(headers);
      expect(session).toBeDefined();
      expect(session?.user.id).toBe(testUserId);
      expect(session?.user.email).toBe(testEmail);
    });

    it('should return null for invalid session', async () => {
      const invalidHeaders = new Headers();
      invalidHeaders.set('cookie', 'revealui-session=invalid-token');
      const session = await getSession(invalidHeaders);
      expect(session).toBeNull();
    });

    it('should delete session', async () => {
      // Create a fresh session for this test
      const result = await signIn(testEmail, testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBeDefined();

      const sessionToken = result.sessionToken;
      if (!sessionToken) {
        throw new Error('Session token should be defined for delete test');
      }
      const headers = new Headers();
      headers.set('cookie', `revealui-session=${sessionToken}`);

      const deleted = await deleteSession(headers);
      expect(deleted).toBe(true);

      // Verify session is deleted
      const session = await getSession(headers);
      expect(session).toBeNull();
    });
  });
});
