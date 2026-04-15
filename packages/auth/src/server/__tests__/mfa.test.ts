import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (vi.mock is hoisted above imports by Vitest)
// ---------------------------------------------------------------------------

// Mock bcryptjs
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}));

// Mock TwoFactorAuth
vi.mock('@revealui/core/security', () => ({
  TwoFactorAuth: {
    generateSecret: vi.fn(() => 'MOCK_SECRET_BASE32'),
    verifyCode: vi.fn(() => true),
    generateCode: vi.fn(() => '123456'),
  },
}));

// Chain mocks for drizzle-orm query builder
const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  users: {
    id: 'id',
    mfaEnabled: 'mfaEnabled',
    mfaSecret: 'mfaSecret',
    mfaBackupCodes: 'mfaBackupCodes',
    mfaVerifiedAt: 'mfaVerifiedAt',
    password: 'password',
    updatedAt: 'updatedAt',
  },
}));

// Mock @revealui/db/crypto (TOTP secret encryption)
const mockEncryptField = vi.fn((v: string) => `encrypted:${v}`);
const mockDecryptFieldOrPassthrough = vi.fn((v: string) =>
  v.startsWith('encrypted:') ? v.slice('encrypted:'.length) : v,
);
vi.mock('@revealui/db/crypto', () => ({
  encryptField: (...args: unknown[]) => mockEncryptField(...args),
  decryptFieldOrPassthrough: (...args: unknown[]) => mockDecryptFieldOrPassthrough(...args),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
}));

import { disableMFA, initiateMFASetup, verifyMFACode, verifyMFASetup } from '../mfa.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mfa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup drizzle chain mocks after clearAllMocks
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  describe('disableMFA with password proof', () => {
    it('succeeds when password matches', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: true, password: '$2a$12$hashedpassword' }]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await disableMFA('user-1', {
        method: 'password',
        password: 'correct-password',
      });

      expect(result).toEqual({ success: true });
      expect(mockBcryptCompare).toHaveBeenCalledWith('correct-password', '$2a$12$hashedpassword');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('fails when password is invalid', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: true, password: '$2a$12$hashedpassword' }]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      const result = await disableMFA('user-1', {
        method: 'password',
        password: 'wrong-password',
      });

      expect(result).toEqual({ success: false, error: 'Invalid password' });
    });

    it('fails when user has no password (OAuth-only account)', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: true, password: null }]);

      const result = await disableMFA('user-1', {
        method: 'password',
        password: 'any-password',
      });

      expect(result).toEqual({
        success: false,
        error: 'Password verification required',
      });
    });

    it('fails when MFA is not enabled', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: false, password: '$2a$12$hashedpassword' }]);

      const result = await disableMFA('user-1', {
        method: 'password',
        password: 'any-password',
      });

      expect(result).toEqual({ success: false, error: 'MFA is not enabled' });
    });

    it('fails when user not found', async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await disableMFA('nonexistent', {
        method: 'password',
        password: 'any-password',
      });

      expect(result).toEqual({ success: false, error: 'User not found' });
    });
  });

  describe('initiateMFASetup', () => {
    it('encrypts the TOTP secret before storing', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: false }]);
      mockBcryptHash.mockImplementation(async (code: string) => `hashed:${code}`);

      const result = await initiateMFASetup('user-1', 'test@example.com');

      expect(result.success).toBe(true);
      expect(result.secret).toBe('MOCK_SECRET_BASE32');
      expect(mockEncryptField).toHaveBeenCalledWith('MOCK_SECRET_BASE32');
      // Verify the encrypted value was passed to the DB, not the plaintext
      const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(setArg?.mfaSecret).toBe('encrypted:MOCK_SECRET_BASE32');
    });
  });

  describe('verifyMFASetup', () => {
    it('decrypts the TOTP secret before verification', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          mfaEnabled: false,
          mfaSecret: 'encrypted:MOCK_SECRET_BASE32',
        },
      ]);
      // TwoFactorAuth.verifyCode is already mocked to return true

      const result = await verifyMFASetup('user-1', '123456');

      expect(result.success).toBe(true);
      expect(mockDecryptFieldOrPassthrough).toHaveBeenCalledWith('encrypted:MOCK_SECRET_BASE32');
    });
  });

  describe('verifyMFACode', () => {
    it('decrypts the TOTP secret before verification', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          mfaEnabled: true,
          mfaSecret: 'encrypted:MOCK_SECRET_BASE32',
          mfaLastUsedCounter: null,
        },
      ]);

      const result = await verifyMFACode('user-1', '123456');

      expect(result.success).toBe(true);
      expect(mockDecryptFieldOrPassthrough).toHaveBeenCalledWith('encrypted:MOCK_SECRET_BASE32');
    });

    it('handles legacy plaintext secrets (rolling migration)', async () => {
      mockLimit.mockResolvedValueOnce([
        {
          mfaEnabled: true,
          mfaSecret: 'PLAINTEXT_BASE32',
          mfaLastUsedCounter: null,
        },
      ]);

      const result = await verifyMFACode('user-1', '123456');

      expect(result.success).toBe(true);
      // decryptFieldOrPassthrough passes through non-encrypted values
      expect(mockDecryptFieldOrPassthrough).toHaveBeenCalledWith('PLAINTEXT_BASE32');
    });
  });

  describe('disableMFA with passkey proof', () => {
    it('succeeds without password verification', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: true, password: null }]);

      const result = await disableMFA('user-1', {
        method: 'passkey',
        verified: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('succeeds even when user has a password (passkey skips password check)', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: true, password: '$2a$12$hashedpassword' }]);

      const result = await disableMFA('user-1', {
        method: 'passkey',
        verified: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    it('fails when MFA is not enabled', async () => {
      mockLimit.mockResolvedValueOnce([{ mfaEnabled: false, password: null }]);

      const result = await disableMFA('user-1', {
        method: 'passkey',
        verified: true,
      });

      expect(result).toEqual({ success: false, error: 'MFA is not enabled' });
    });

    it('fails when user not found', async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await disableMFA('nonexistent', {
        method: 'passkey',
        verified: true,
      });

      expect(result).toEqual({ success: false, error: 'User not found' });
    });
  });
});
