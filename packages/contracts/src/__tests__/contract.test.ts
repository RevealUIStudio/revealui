/**
 * Unified Contract System Tests
 *
 * Tests the base Contract interface and factory functions
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { type ContractType, contractRegistry, createContract } from '../foundation/contract.js';

describe('Unified Contract System', () => {
  describe('createContract', () => {
    it('creates a contract with all required properties', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().min(1),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
        description: 'User entity contract',
      });

      expect(UserContract.metadata.name).toBe('User');
      expect(UserContract.metadata.version).toBe('1.0.0');
      expect(UserContract.metadata.description).toBe('User entity contract');
      expect(UserContract.schema).toBe(UserSchema);
    });

    it('validates data correctly', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().min(1),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
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
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('returns errors for invalid data', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().min(1),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
      });

      const invalidData = {
        id: '123',
        email: 'invalid-email',
        name: '',
      };

      const result = UserContract.validate(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.issues.length).toBeGreaterThan(0);
      }
    });

    it('provides type guard functionality', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
      });

      const validData = {
        id: '123',
        email: 'test@example.com',
      };

      const invalidData = {
        id: '123',
        email: 'invalid',
      };

      expect(UserContract.isType(validData)).toBe(true);
      expect(UserContract.isType(invalidData)).toBe(false);
    });

    it('narrows types correctly with type guard', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
      });

      const unknownData: unknown = {
        id: '123',
        email: 'test@example.com',
      };

      if (UserContract.isType(unknownData)) {
        // TypeScript should narrow unknownData to User type here
        expect(unknownData.email).toBe('test@example.com');
        expect(unknownData.id).toBe('123');
      }
    });

    it('parses data and throws on validation failure', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
      });

      const validData = {
        id: '123',
        email: 'test@example.com',
      };

      const parsed = UserContract.parse(validData);
      expect(parsed).toEqual(validData);

      const invalidData = {
        id: '123',
        email: 'invalid',
      };

      expect(() => UserContract.parse(invalidData)).toThrow();
    });

    it('supports ContractType utility type', () => {
      const UserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
      });

      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: UserSchema,
      });

      type User = ContractType<typeof UserContract>;

      // This should compile without errors
      const user: User = {
        id: '123',
        email: 'test@example.com',
      };

      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
    });

    it('supports optional metadata fields', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
        docsUrl: 'https://example.com/docs',
        tags: ['entity', 'user'],
        deprecated: true,
        deprecatedMessage: 'Use NewUserContract instead',
      });

      expect(UserContract.metadata.docsUrl).toBe('https://example.com/docs');
      expect(UserContract.metadata.tags).toEqual(['entity', 'user']);
      expect(UserContract.metadata.deprecated).toBe(true);
      expect(UserContract.metadata.deprecatedMessage).toBe('Use NewUserContract instead');
    });
  });

  describe('contractRegistry', () => {
    beforeEach(() => {
      contractRegistry.clear();
    });

    it('registers and retrieves contracts', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
      });

      contractRegistry.register(UserContract);

      const retrieved = contractRegistry.get('User', '1.0.0');
      expect(retrieved).toBe(UserContract);
    });

    it('retrieves latest version of a contract', () => {
      const UserV1 = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
      });

      const UserV2 = createContract({
        name: 'User',
        version: '2.0.0',
        schema: z.object({ id: z.string(), email: z.string() }),
      });

      contractRegistry.register(UserV1);
      contractRegistry.register(UserV2);

      const latest = contractRegistry.getLatest('User');
      expect(latest).toBe(UserV2);
      expect(latest?.metadata.version).toBe('2.0.0');
    });

    it('lists all registered contracts', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
      });

      const PostContract = createContract({
        name: 'Post',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
      });

      contractRegistry.register(UserContract);
      contractRegistry.register(PostContract);

      const contracts = contractRegistry.list();
      expect(contracts).toHaveLength(2);
      expect(contracts.map((c) => c.metadata.name)).toContain('User');
      expect(contracts.map((c) => c.metadata.name)).toContain('Post');
    });

    it('clears all contracts', () => {
      const UserContract = createContract({
        name: 'User',
        version: '1.0.0',
        schema: z.object({ id: z.string() }),
      });

      contractRegistry.register(UserContract);
      expect(contractRegistry.list()).toHaveLength(1);

      contractRegistry.clear();
      expect(contractRegistry.list()).toHaveLength(0);
    });
  });
});
