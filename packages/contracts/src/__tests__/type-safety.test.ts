/**
 * Type Safety Tests for Contracts
 *
 * These tests verify that TypeScript types are correctly inferred
 * from contracts and that type guards work properly.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { type ContractType, createContract } from '../foundation/contract.js';

describe('Contract Type Safety', () => {
  describe('Type Inference', () => {
    it('infers correct types from simple schemas', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
          name: z.string(),
        }),
      });

      type User = ContractType<typeof UserContract>;

      // This should compile - all properties exist
      const user: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test',
      };

      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test');
    });

    it('infers correct types from nested schemas', () => {
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
          tags: z.array(z.string()),
        }),
      });

      type Post = ContractType<typeof PostContract>;

      const post: Post = {
        id: '1',
        title: 'Test Post',
        author: {
          id: '123',
          name: 'Author',
        },
        tags: ['test', 'example'],
      };

      expect(post.author.name).toBe('Author');
      expect(post.tags).toHaveLength(2);
    });

    it('infers correct types from union schemas', () => {
      const StatusContract = createContract({
        name: 'Status',
        version: '1.0.0',
        schema: z.union([
          z.object({ type: z.literal('success'), data: z.string() }),
          z.object({ type: z.literal('error'), message: z.string() }),
        ]),
      });

      type Status = ContractType<typeof StatusContract>;

      const success: Status = {
        type: 'success',
        data: 'Done',
      };

      const error: Status = {
        type: 'error',
        message: 'Failed',
      };

      expect(success.type).toBe('success');
      expect(error.type).toBe('error');
    });
  });

  describe('Type Guards', () => {
    it('narrows unknown types correctly', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const unknownData: unknown = {
        id: '123',
        email: 'test@example.com',
      };

      if (UserContract.isType(unknownData)) {
        // TypeScript should narrow unknownData to User type
        // These should compile without errors
        expect(unknownData.id).toBe('123');
        expect(unknownData.email).toBe('test@example.com');
      }
    });

    it('rejects invalid data in type guards', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const invalidData: unknown = {
        id: '123',
        email: 'not-an-email',
      };

      expect(UserContract.isType(invalidData)).toBe(false);
    });

    it('works with nested type guards', () => {
      const PostContract = createContract({
        name: 'Post',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          author: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      });

      const unknownData: unknown = {
        id: '1',
        author: {
          id: '123',
          name: 'Author',
        },
      };

      if (PostContract.isType(unknownData)) {
        // TypeScript should narrow to Post type
        expect(unknownData.author.name).toBe('Author');
      }
    });
  });

  describe('Validation Result Types', () => {
    it('provides correct types for validation results', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const result = UserContract.validate({
        id: '123',
        email: 'test@example.com',
      });

      if (result.success) {
        // TypeScript should know result.data is User type
        expect(result.data.id).toBe('123');
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('provides correct types for validation failures', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({
          id: z.string(),
          email: z.string().email(),
        }),
      });

      const result = UserContract.validate({
        id: '123',
        email: 'invalid',
      });

      if (!result.success) {
        // TypeScript should know result.errors exists
        expect(result.errors).toBeDefined();
        expect(result.errors.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
