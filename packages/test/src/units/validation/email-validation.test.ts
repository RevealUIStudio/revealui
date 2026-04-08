/**
 * Unit tests for email validation utilities
 *
 * Tests REAL email validation from apps/admin/src/lib/validation/schemas.ts
 */

import { emailSchema } from '@admin/lib/validation/schemas';
import { describe, expect, it } from 'vitest';

describe('Email Validation (Real Framework Code)', () => {
  describe('emailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.co.uk',
        'user+tag@example.com',
        'user_name@example-domain.com',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email);
        }
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        '@example.com',
        'user@',
        'user@example',
        'user example.com',
        'user..test@example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });
    });

    it('should reject emails exceeding max length', () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too long');
      }
    });

    it('should reject empty strings', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required');
      }
    });

    it('should provide proper error messages', () => {
      const result = emailSchema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.issues[0].message;
        expect(errorMessage).toContain('Invalid email format');
      }
    });

    it('should handle edge cases correctly', () => {
      const edgeCases = [
        { email: 'user@.com', shouldFail: true },
        { email: 'user@example..com', shouldFail: true },
        { email: '.user@example.com', shouldFail: true },
        { email: 'user@example.com.', shouldFail: true },
      ];

      edgeCases.forEach(({ email, shouldFail }) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(!shouldFail);
      });
    });
  });
});
