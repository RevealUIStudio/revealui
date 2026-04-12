import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Use real validatePasswordStrength (not mocked)  -  ensures test coverage
// catches regressions in password strength rules.
// Mock checkPasswordBreach to avoid real HIBP network calls.
vi.mock('../password-validation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../password-validation.js')>();
  return {
    ...actual,
    checkPasswordBreach: vi.fn().mockResolvedValue(0),
  };
});

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
  },
}));

// Chain mocks for drizzle-orm query builder
const mockRows: Record<string, unknown>[][] = [[]];
const mockLimit = vi.fn().mockImplementation(() => Promise.resolve(mockRows[0]));
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  users: { email: 'email', id: 'id' },
  passwordResetTokens: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    tokenSalt: 'tokenSalt',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
  },
  sessions: { userId: 'userId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args) => ({ and: args })),
  gt: vi.fn((_col, val) => ({ gt: val })),
  isNull: vi.fn((_col) => ({ isNull: true })),
}));

import {
  generatePasswordResetToken,
  invalidatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
} from '../password-reset.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows[0] = [];
  });

  describe('generatePasswordResetToken', () => {
    it('returns success with dummy token for non-existent user', async () => {
      mockRows[0] = []; // No user found

      const result = await generatePasswordResetToken('nobody@example.com');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token!.length).toBe(64); // 32 bytes hex
    });

    it('returns success with real token for existing user', async () => {
      mockRows[0] = [{ id: 'user-1', email: 'test@example.com' }];

      const result = await generatePasswordResetToken('test@example.com');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.tokenId).toBeDefined();
    });

    it('invalidates existing tokens before creating new one', async () => {
      mockRows[0] = [{ id: 'user-1', email: 'test@example.com' }];

      await generatePasswordResetToken('test@example.com');

      // update() is called to invalidate existing tokens
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('inserts hashed token into database', async () => {
      mockRows[0] = [{ id: 'user-1', email: 'test@example.com' }];

      await generatePasswordResetToken('test@example.com');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          tokenSalt: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('returns failure on database error', async () => {
      mockSelect.mockImplementationOnce(() => {
        throw new Error('DB connection failed');
      });

      const result = await generatePasswordResetToken('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate reset token');
    });
  });

  describe('validatePasswordResetToken', () => {
    it('returns null for non-existent token', async () => {
      mockRows[0] = [];

      const result = await validatePasswordResetToken('token-id', 'token-value');

      expect(result).toBeNull();
    });

    it('returns userId for valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      const result = await validatePasswordResetToken('token-id', token);

      expect(result).toBe('user-1');
    });

    it('returns null for wrong token', async () => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update('correct-token').digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      const result = await validatePasswordResetToken('token-id', 'wrong-token');

      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      mockSelect.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await validatePasswordResetToken('token-id', 'token');

      expect(result).toBeNull();
    });
  });

  describe('resetPasswordWithToken', () => {
    it('returns failure for non-existent token', async () => {
      mockRows[0] = [];

      const result = await resetPasswordWithToken('token-id', 'token', 'NewPassword123!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired reset token');
    });

    it('returns failure for wrong token hash', async () => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update('real-token').digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      const result = await resetPasswordWithToken('token-id', 'wrong-token', 'NewPassword123!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired reset token');
    });

    it('returns failure for weak password', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      const result = await resetPasswordWithToken('token-id', token, 'short');

      expect(result.success).toBe(false);
      expect(result.error).toContain('8 characters');
    });

    it('returns failure for password missing uppercase/numbers', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      // Passes length check but fails uppercase + number requirement
      const result = await resetPasswordWithToken('token-id', token, 'alllowercase');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns success for valid reset', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      const result = await resetPasswordWithToken('token-id', token, 'StrongPassword123!');

      expect(result.success).toBe(true);
    });

    it('invalidates all sessions after password reset', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      await resetPasswordWithToken('token-id', token, 'StrongPassword123!');

      // delete() called for sessions
      expect(mockDelete).toHaveBeenCalled();
    });

    it('marks token as used after reset', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      await resetPasswordWithToken('token-id', token, 'StrongPassword123!');

      // update() called to mark token as used
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns failure on database error', async () => {
      mockSelect.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await resetPasswordWithToken('id', 'token', 'Pass1234!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to reset password');
    });
  });

  describe('invalidatePasswordResetToken', () => {
    it('does nothing for non-existent token', async () => {
      mockRows[0] = [];

      await invalidatePasswordResetToken('token-id', 'token');

      // update() should not be called for marking as used
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('marks valid token as used', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      await invalidatePasswordResetToken('token-id', token);

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('does not invalidate with wrong token', async () => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update('real-token').digest('hex');

      mockRows[0] = [
        {
          id: 'token-id',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60000),
          usedAt: null,
        },
      ];

      await invalidatePasswordResetToken('token-id', 'wrong-token');

      // update() should not be called  -  hash mismatch
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('handles database errors gracefully', async () => {
      mockSelect.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      // Should not throw
      await expect(invalidatePasswordResetToken('id', 'token')).resolves.toBeUndefined();
    });
  });
});
