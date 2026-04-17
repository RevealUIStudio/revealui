/**
 * Authentication Tests
 *
 * Unit tests for authentication functions.
 */

import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn, signUp } from '../server/auth.js';

// Mock database client
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '',
  role: 'viewer',
  status: 'active',
};

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => []),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => [mockUser]),
    })),
  })),
};

// Mock config to avoid validation errors in tests
vi.mock('@revealui/config', () => ({
  default: {
    database: {
      url: undefined, // No database in tests - use in-memory storage
    },
  },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

// Mock HIBP breach check to avoid real network calls
vi.mock('../server/password-validation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/password-validation.js')>();
  return {
    ...actual,
    checkPasswordBreach: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('../server/session', () => ({
  createSession: vi.fn(async () => ({
    token: 'session-token-123',
    session: {
      id: 'session-123',
      userId: 'user-123',
      expiresAt: new Date(),
    },
  })),
}));

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SIGNUP_OPEN = 'true';
  });

  describe('signIn', () => {
    it('should return error if user not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => []), // No user found
          })),
        })),
      });

      const result = await signIn('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should return error if password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 12);
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [
              {
                ...mockUser,
                passwordHash: hashedPassword,
              },
            ]),
          })),
        })),
      });

      const result = await signIn('test@example.com', 'wrong-password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should return error if user has no password hash', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [
              {
                ...mockUser,
                passwordHash: null, // OAuth-only user
              },
            ]),
          })),
        })),
      });

      const result = await signIn('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('signUp', () => {
    /** Helper: mock a select() chain returning the given rows */
    function mockSelectChain(rows: unknown[]) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => rows),
          })),
        })),
      };
    }

    it('should return error if user already exists', async () => {
      vi.clearAllMocks();

      // First select (users table) returns existing user  -  OAuth check never reached
      mockDb.select.mockReturnValueOnce(mockSelectChain([mockUser]));

      const result = await signUp('test@example.com', 'Password123', 'Test User');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to create account');
    });

    it('should block signup when OAuth account exists with same email', async () => {
      vi.clearAllMocks();

      // First select (users table): no password user
      mockDb.select.mockReturnValueOnce(mockSelectChain([]));
      // Second select (oauth_accounts table): OAuth account exists
      mockDb.select.mockReturnValueOnce(mockSelectChain([{ id: 'oauth-acc-1' }]));

      const result = await signUp('oauth@example.com', 'Password123', 'Attacker');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to create account');
    });

    it('should create user and session on success', async () => {
      vi.clearAllMocks();

      const newUser = {
        ...mockUser,
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
      };

      // First select (users table): no existing user
      mockDb.select.mockReturnValueOnce(mockSelectChain([]));
      // Second select (oauth_accounts table): no OAuth account
      mockDb.select.mockReturnValueOnce(mockSelectChain([]));

      mockDb.insert.mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => [newUser]),
        })),
      });

      const result = await signUp('new@example.com', 'Password123', 'New User');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.sessionToken).toBeDefined();
    });
  });
});
