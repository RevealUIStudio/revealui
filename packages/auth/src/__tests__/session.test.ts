/**
 * Session Management Tests
 *
 * Unit tests for session management functions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, deleteSession, getSession } from '../server/session.js';
import { hashToken } from '../utils/token.js';

// Mock database client
const mockInsert = vi.fn();
const mockDeleteWhere = vi.fn();
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: mockInsert,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: mockDeleteWhere,
    })),
  })),
}));

// Pass-through spy on hashToken so tests can assert which tokens were hashed
// without changing the real hashing behavior.
vi.mock('../utils/token.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token.js')>();
  return {
    ...actual,
    hashToken: vi.fn((token: string) => actual.hashToken(token)),
  };
});

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior
    mockDeleteWhere.mockResolvedValue({ rowCount: 1 });
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: 'session-123',
            userId: 'user-123',
            tokenHash: 'hashed-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            lastActivityAt: new Date(),
          },
        ]),
      })),
    });
  });

  describe('createSession', () => {
    it('should create a session with token', async () => {
      const result = await createSession('user-123', {
        persistent: true,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(result.token).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.userId).toBe('user-123');
    });

    it('should set expiration based on persistent flag', async () => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      // Mock regular session (1 day expiration) - capture the actual expiration calculated
      let regularExpiry: Date;
      mockInsert.mockReturnValueOnce({
        values: vi.fn(() => {
          // The actual implementation calculates expiration, so we need to capture it
          regularExpiry = new Date(now + oneDay);
          return {
            returning: vi.fn(() => [
              {
                id: 'session-regular',
                userId: 'user-123',
                tokenHash: 'hashed-token-regular',
                expiresAt: regularExpiry,
                createdAt: new Date(),
                lastActivityAt: new Date(),
              },
            ]),
          };
        }),
      });

      // Mock persistent session (7 days expiration)
      let persistentExpiry: Date;
      mockInsert.mockReturnValueOnce({
        values: vi.fn(() => {
          persistentExpiry = new Date(now + sevenDays);
          return {
            returning: vi.fn(() => [
              {
                id: 'session-persistent',
                userId: 'user-123',
                tokenHash: 'hashed-token-persistent',
                expiresAt: persistentExpiry,
                createdAt: new Date(),
                lastActivityAt: new Date(),
              },
            ]),
          };
        }),
      });

      // Create regular session first
      const regular = await createSession('user-123', { persistent: false });

      // Create persistent session
      const persistent = await createSession('user-123', { persistent: true });

      // Verify expiration times
      const regularTime = regular.session.expiresAt.getTime();
      const persistentTime = persistent.session.expiresAt.getTime();
      const daysDifference = (persistentTime - regularTime) / (1000 * 60 * 60 * 24);

      // Persistent sessions should expire later (7 days vs 1 day = 6 days difference)
      // Allow some tolerance for timing
      expect(daysDifference).toBeGreaterThan(5.5); // Should be ~6 days
      expect(daysDifference).toBeLessThan(6.5); // Should be less than 7 days
    });
  });

  describe('getSession', () => {
    it('should return null if no cookie header', async () => {
      const headers = new Headers();
      const session = await getSession(headers);
      expect(session).toBeNull();
    });

    it('should return null if invalid session token', async () => {
      const headers = new Headers();
      headers.set('cookie', 'revealui-session=invalid-token');
      const session = await getSession(headers);
      // Will return null because session not found in database
      expect(session).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should return false if no cookie header', async () => {
      const headers = new Headers();
      const deleted = await deleteSession(headers);
      expect(deleted).toBe(false);
    });

    it('revokes every distinct session token when duplicate cookies are present', async () => {
      const headers = new Headers();
      headers.set(
        'cookie',
        'revealui-session=tok-a; revealui-role=admin; revealui-session=tok-b; revealui-session=tok-a',
      );

      const deleted = await deleteSession(headers);
      expect(deleted).toBe(true);

      // Both distinct tokens hashed (deduped), single batched delete.
      const hashedTokens = vi.mocked(hashToken).mock.calls.map((call) => call[0]);
      expect(hashedTokens).toEqual(['tok-a', 'tok-b']);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });

    it('returns false when no matching session row exists', async () => {
      mockDeleteWhere.mockResolvedValueOnce({ rowCount: 0 });

      const headers = new Headers();
      headers.set('cookie', 'revealui-session=unknown-token');

      const deleted = await deleteSession(headers);
      expect(deleted).toBe(false);
    });

    it('returns false when the driver result exposes no rowCount', async () => {
      mockDeleteWhere.mockResolvedValueOnce({});

      const headers = new Headers();
      headers.set('cookie', 'revealui-session=tok-a');

      const deleted = await deleteSession(headers);
      expect(deleted).toBe(false);
    });

    it('skips malformed percent-encoded duplicates without aborting sign-out', async () => {
      const headers = new Headers();
      headers.set('cookie', 'revealui-session=%E0%A4%A; revealui-session=tok-ok');

      const deleted = await deleteSession(headers);
      expect(deleted).toBe(true);

      const hashedTokens = vi.mocked(hashToken).mock.calls.map((call) => call[0]);
      expect(hashedTokens).toEqual(['tok-ok']);
    });
  });
});
