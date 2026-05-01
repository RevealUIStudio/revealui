/**
 * Runtime Validation Tests for Contracts
 *
 * These tests verify that contracts correctly validate data at runtime
 * and provide proper error handling.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

describe('Contract Runtime Validation', () => {
  describe('Basic Validation', () => {
    it('validates simple objects correctly', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string().min(1),
        }),
      });

      const validData = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = UserContract.validate(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('rejects invalid data with detailed errors', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string().min(1),
        }),
      });

      const invalidData = {
        id: '123',
        email: 'not-an-email',
        name: '',
      };

      const result = UserContract.validate(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.length).toBeGreaterThan(0);
        // Should have error for email
        const emailError = result.errors.issues.find((issue) => issue.path.includes('email'));
        expect(emailError).toBeDefined();
        // Should have error for name
        const nameError = result.errors.issues.find((issue) => issue.path.includes('name'));
        expect(nameError).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles null and undefined correctly', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      expect(UserContract.isType(null)).toBe(false);
      expect(UserContract.isType(undefined)).toBe(false);
      expect(UserContract.validate(null).success).toBe(false);
      expect(UserContract.validate(undefined).success).toBe(false);
    });

    it('handles wrong types correctly', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      expect(UserContract.isType('string')).toBe(false);
      expect(UserContract.isType(123)).toBe(false);
      expect(UserContract.isType([])).toBe(false);
      expect(UserContract.isType({})).toBe(false); // Missing required fields
    });

    it('handles extra properties correctly', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const dataWithExtra = {
        id: '123',
        email: 'test@example.com',
        extra: 'property',
      };

      // Zod by default strips extra properties, but we can test the behavior
      const result = UserContract.validate(dataWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        // Extra property should be stripped
        expect('extra' in result.data).toBe(false);
      }
    });
  });

  describe('Complex Validation', () => {
    it('validates nested objects correctly', () => {
      const PostContract = createContract({
        name: 'Post',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          title: z.string(),
          author: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      });

      const validData = {
        id: '1',
        title: 'Test Post',
        author: {
          id: '123',
          name: 'Author',
        },
      };

      const result = PostContract.validate(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.author.name).toBe('Author');
      }
    });

    it('validates arrays correctly', () => {
      const TagsContract = createContract({
        name: 'Tags',
        version: '1.0.0',
        schema: z.object({
          tags: z.array(z.string()),
        }),
      });

      const validData = {
        tags: ['tag1', 'tag2', 'tag3'],
      };

      const result = TagsContract.validate(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toHaveLength(3);
      }
    });

    it('validates unions correctly', () => {
      const StatusContract = createContract({
        name: 'Status',
        version: '1.0.0',
        schema: z.union([
          z.object({ type: z.literal('success'), data: z.string() }),
          z.object({ type: z.literal('error'), message: z.string() }),
        ]),
      });

      const successData = { type: 'success' as const, data: 'Done' };
      const errorData = { type: 'error' as const, message: 'Failed' };

      expect(StatusContract.validate(successData).success).toBe(true);
      expect(StatusContract.validate(errorData).success).toBe(true);
      expect(StatusContract.validate({ type: 'unknown' }).success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('parse throws on validation failure', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const invalidData = {
        id: '123',
        email: 'invalid',
      };

      expect(() => UserContract.parse(invalidData)).toThrow();
    });

    it('safeParse returns result without throwing', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const invalidData = {
        id: '123',
        email: 'invalid',
      };

      const result = UserContract.safeParse(invalidData);
      expect(result.success).toBe(false);
      // Should not throw
      expect(() => UserContract.safeParse(invalidData)).not.toThrow();
    });
  });
});
