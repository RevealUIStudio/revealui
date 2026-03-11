/**
 * Auth Contract Tests
 *
 * Tests for authentication API contracts
 */

import { describe, expect, it } from 'vitest';
import {
  PasswordResetRequestContract,
  PasswordResetTokenContract,
  SignInRequestContract,
  SignUpRequestContract,
} from '../auth.js';

describe('SignUpRequestContract', () => {
  describe('valid data', () => {
    it('validates correct sign-up data', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
        name: 'John Doe',
        tosAccepted: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.password).toBe('SecurePass123');
        expect(result.data.name).toBe('John Doe');
      }
    });

    it('sanitizes email (lowercase)', () => {
      const result = SignUpRequestContract.validate({
        email: 'USER@EXAMPLE.COM',
        password: 'SecurePass123',
        name: 'John Doe',
        tosAccepted: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('sanitizes name (trim and normalize spaces)', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
        name: '  John   Doe  ',
        tosAccepted: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects missing email', () => {
      const result = SignUpRequestContract.validate({
        password: 'SecurePass123',
        name: 'John Doe',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('email');
      }
    });

    it('rejects invalid email format', () => {
      const result = SignUpRequestContract.validate({
        email: 'not-an-email',
        password: 'SecurePass123',
        name: 'John Doe',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });

    it('rejects password shorter than 8 characters', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'Short1',
        name: 'John Doe',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('at least 8 characters');
      }
    });

    it('rejects missing name', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('name');
      }
    });

    it('rejects empty name', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
        name: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('required');
      }
    });

    it('rejects name longer than 100 characters', () => {
      const result = SignUpRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
        name: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('less than 100');
      }
    });
  });
});

describe('SignInRequestContract', () => {
  describe('valid data', () => {
    it('validates correct sign-in data', () => {
      const result = SignInRequestContract.validate({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.password).toBe('SecurePass123');
      }
    });

    it('sanitizes email (lowercase)', () => {
      const result = SignInRequestContract.validate({
        email: 'USER@EXAMPLE.COM',
        password: 'SecurePass123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects missing email', () => {
      const result = SignInRequestContract.validate({
        password: 'SecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('email');
      }
    });

    it('rejects invalid email format', () => {
      const result = SignInRequestContract.validate({
        email: 'not-an-email',
        password: 'SecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });

    it('rejects missing password', () => {
      const result = SignInRequestContract.validate({
        email: 'user@example.com',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('password');
      }
    });
  });
});

describe('PasswordResetRequestContract', () => {
  describe('valid data', () => {
    it('validates correct password reset request', () => {
      const result = PasswordResetRequestContract.validate({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('sanitizes email (lowercase)', () => {
      const result = PasswordResetRequestContract.validate({
        email: 'USER@EXAMPLE.COM',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects missing email', () => {
      const result = PasswordResetRequestContract.validate({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('email');
      }
    });

    it('rejects invalid email format', () => {
      const result = PasswordResetRequestContract.validate({
        email: 'not-an-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('Invalid email format');
      }
    });
  });
});

describe('PasswordResetTokenContract', () => {
  describe('valid data', () => {
    it('validates correct password reset with token', () => {
      const result = PasswordResetTokenContract.validate({
        tokenId: 'abc-123-def',
        token: 'reset-token-12345',
        password: 'NewSecurePass123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tokenId).toBe('abc-123-def');
        expect(result.data.token).toBe('reset-token-12345');
        expect(result.data.password).toBe('NewSecurePass123');
      }
    });
  });

  describe('invalid data', () => {
    it('rejects missing tokenId', () => {
      const result = PasswordResetTokenContract.validate({
        token: 'reset-token-12345',
        password: 'NewSecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('tokenId');
      }
    });

    it('rejects missing token', () => {
      const result = PasswordResetTokenContract.validate({
        tokenId: 'abc-123-def',
        password: 'NewSecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('token');
      }
    });

    it('rejects empty token', () => {
      const result = PasswordResetTokenContract.validate({
        tokenId: 'abc-123-def',
        token: '',
        password: 'NewSecurePass123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('required');
      }
    });

    it('rejects missing password', () => {
      const result = PasswordResetTokenContract.validate({
        tokenId: 'abc-123-def',
        token: 'reset-token-12345',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.path).toContain('password');
      }
    });

    it('rejects password shorter than 8 characters', () => {
      const result = PasswordResetTokenContract.validate({
        tokenId: 'abc-123-def',
        token: 'reset-token-12345',
        password: 'Short1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues[0]?.message).toContain('at least 8 characters');
      }
    });
  });
});
