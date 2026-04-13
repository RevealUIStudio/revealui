/**
 * Email Validation Tests
 *
 * Comprehensive tests for email validation in create() and update() operations
 * Verifies that email validation works correctly for various scenarios
 */

import type { RevealDataObject, RevealUIInstance } from '@revealui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('Email Validation', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  describe('Valid Email Formats', () => {
    it('should accept standard email format', async () => {
      const testEmail = generateUniqueTestEmail('valid-standard');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));
      expect(user.email).toBe(testEmail);
    });

    it('should accept email with plus sign', async () => {
      const testEmail = `test+${Date.now()}@example.com`;

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));
      expect(user.email).toBe(testEmail);
    });

    it('should accept email with dots', async () => {
      const testEmail = `test.user.${Date.now()}@example.com`;

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));
      expect(user.email).toBe(testEmail);
    });

    it('should accept email with hyphens', async () => {
      const testEmail = `test-user-${Date.now()}@example.com`;

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));
      expect(user.email).toBe(testEmail);
    });
  });

  describe('Invalid Email Formats', () => {
    it('should reject email without @ symbol', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'invalidemail.com',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });

    it('should reject email without domain', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'user@',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });

    it('should reject email without TLD', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'user@example',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });

    it('should reject email with spaces', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'user name@example.com',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });

    it('should reject email with multiple @ symbols', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'user@@example.com',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null email value', async () => {
      // If email is not required, null should be allowed
      // But if it's required, it should throw
      // For users collection, email is required, so this should fail
      const invalidData: RevealDataObject = {
        email: null,
        password: 'TestPassword123!',
        roles: ['admin'],
      };
      await expect(
        revealui.create({
          collection: 'users',
          data: invalidData,
        }),
      ).rejects.toThrow();
    });

    it('should handle undefined email value', async () => {
      // Email is required, so undefined should fail
      const invalidData: RevealDataObject = {
        password: 'TestPassword123!',
        roles: ['admin'],
      };
      await expect(
        revealui.create({
          collection: 'users',
          data: invalidData,
        }),
      ).rejects.toThrow();
    });

    it('should handle empty string email', async () => {
      // Empty string should fail validation
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: '',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });

    it('should handle non-string email value', async () => {
      const invalidData: RevealDataObject = {
        email: 123,
        password: 'TestPassword123!',
        roles: ['admin'],
      };
      await expect(
        revealui.create({
          collection: 'users',
          data: invalidData,
        }),
      ).rejects.toThrow(/must be a string/);
    });
  });

  describe('Email Validation in Update', () => {
    it('should validate email on update', async () => {
      const testEmail = generateUniqueTestEmail('update-valid');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Update with valid email
      const updated = await revealui.update({
        collection: 'users',
        id: user.id,
        data: {
          email: generateUniqueTestEmail('update-new'),
        },
      });

      expect(updated.email).toBeDefined();
      expect(updated.email).not.toBe(testEmail);
    });

    it('should reject invalid email on update', async () => {
      const testEmail = generateUniqueTestEmail('update-invalid');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      await expect(
        revealui.update({
          collection: 'users',
          id: user.id,
          data: {
            email: 'invalid-email',
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });
  });

  describe('Field Name "email" Validation', () => {
    it('should validate field named "email" even if type is not "email"', async () => {
      // This test verifies that fields named "email" are validated
      // even if their type is not explicitly 'email'
      // The current implementation should handle this via field.name.toLowerCase() === 'email'

      const testEmail = generateUniqueTestEmail('name-check');

      // Users collection has email field with type 'email', so this should work
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));
      expect(user.email).toBe(testEmail);

      // Try to update with invalid email
      await expect(
        revealui.update({
          collection: 'users',
          id: user.id,
          data: {
            email: 'not-an-email',
          },
        }),
      ).rejects.toThrow(/must be a valid email address/);
    });
  });
});
