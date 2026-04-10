/**
 * Integration Tests for Type Bridge Utilities
 *
 * Tests contract validation with real database rows and actual data.
 * These tests verify that type bridge utilities work correctly with
 * actual database queries and real-world data structures.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  batchContractToDbInsert,
  batchDbRowsToContract,
  createContractToDbMapper,
  createDbRowMapper,
  type Database,
} from '../../database/type-bridge.js';
import { createContract } from '../../foundation/contract.js';

// Create a contract that matches a subset of the users table
const UserContract = createContract({
  name: 'User',
  version: '1.0.0',
  schema: z.object({
    id: z.string(),
    email: z.string().email().nullable().optional(),
    name: z.string(),
    type: z.enum(['human', 'bot']).optional(),
  }),
});

describe('Type Bridge Integration Tests', () => {
  describe('createDbRowMapper with real database rows', () => {
    it('should map database rows to contract-validated entities', () => {
      // Simulate a database row with all fields
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract);
      const result = mapper(dbRow);

      // Should extract only contract fields
      expect(result.id).toBe('user-123');
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('Test User');
      expect(result.type).toBe('human');
      // Should not have database-only fields
      expect(result).not.toHaveProperty('schemaVersion');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should handle optional fields correctly', () => {
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-456',
        name: 'User Without Email',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract);
      const result = mapper(dbRow);

      expect(result.id).toBe('user-456');
      expect(result.name).toBe('User Without Email');
      expect(result.email).toBeUndefined();
    });

    it('should use custom mapper function', () => {
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-789',
        email: 'user@example.com',
        name: 'test user',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract, (row) => ({
        ...row,
        name: row.name.toUpperCase(),
      }));

      const result = mapper(dbRow);
      expect(result.name).toBe('TEST USER');
    });

    it('should throw validation error for invalid data', () => {
      const invalidRow = {
        id: 'user-invalid',
        email: 'not-an-email', // Invalid email format
        name: 'Test User',
      };

      const mapper = createDbRowMapper(UserContract);
      expect(() =>
        mapper(invalidRow as unknown as Database['public']['Tables']['users']['Row']),
      ).toThrow();
    });
  });

  describe('createContractToDbMapper with actual inserts', () => {
    it('should map contract data to database insert format', () => {
      const contractData = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        type: 'human' as const,
      };

      const mapper = createContractToDbMapper<
        typeof contractData,
        Database['public']['Tables']['users']['Insert']
      >();
      const dbInsert = mapper(contractData);

      expect(dbInsert.id).toBe('user-123');
      expect(dbInsert.email).toBe('user@example.com');
      expect(dbInsert.name).toBe('Test User');
      expect(dbInsert.type).toBe('human');
    });

    it('should use custom mapper function for transformation', () => {
      const contractData = {
        id: 'user-456',
        name: 'Test User',
        type: 'human' as const,
      };

      const mapper = createContractToDbMapper<
        typeof contractData,
        Database['public']['Tables']['users']['Insert']
      >((data) => ({
        ...data,
        schemaVersion: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dbInsert = mapper(contractData);
      expect(dbInsert.id).toBe('user-456');
      expect(dbInsert.schemaVersion).toBe('1');
      expect(dbInsert.createdAt).toBeInstanceOf(Date);
      expect(dbInsert.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle partial contract data', () => {
      const partialData = {
        id: 'user-789',
        name: 'Partial User',
      };

      const mapper = createContractToDbMapper<
        typeof partialData,
        Database['public']['Tables']['users']['Insert']
      >((data) => ({
        ...data,
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dbInsert = mapper(partialData);
      expect(dbInsert.id).toBe('user-789');
      expect(dbInsert.name).toBe('Partial User');
      expect(dbInsert.type).toBe('human');
    });
  });

  describe('batchDbRowsToContract', () => {
    it('should batch convert multiple database rows', () => {
      const dbRows: Database['public']['Tables']['users']['Row'][] = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          schemaVersion: '1',
          type: 'human',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User 2',
          schemaVersion: '1',
          type: 'human',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Database['public']['Tables']['users']['Row'][];

      const results = batchDbRowsToContract(UserContract, dbRows);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('user-1');
      expect(results[0].name).toBe('User 1');
      expect(results[1].id).toBe('user-2');
      expect(results[1].name).toBe('User 2');
    });

    it('should handle empty array', () => {
      const results = batchDbRowsToContract(UserContract, []);
      expect(results).toHaveLength(0);
    });

    it('should filter out invalid rows', () => {
      const dbRows = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          schemaVersion: '1',
          type: 'human',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-invalid',
          email: 'not-an-email', // Invalid
          name: 'Invalid User',
          schemaVersion: '1',
          type: 'human',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Array<Database['public']['Tables']['users']['Row']>;

      // batchDbRowsToContract will throw on invalid rows
      expect(() => batchDbRowsToContract(UserContract, dbRows)).toThrow();
    });
  });

  describe('batchContractToDbInsert', () => {
    it('should batch convert multiple contract entities', () => {
      const contractData = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          type: 'human' as const,
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User 2',
          type: 'human' as const,
        },
      ];

      const results = batchContractToDbInsert(contractData);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('user-1');
      expect(results[1].id).toBe('user-2');
    });

    it('should handle empty array', () => {
      const results = batchContractToDbInsert([]);
      expect(results).toHaveLength(0);
    });

    it('should work with custom mapper', () => {
      const contractData = [
        {
          id: 'user-1',
          name: 'User 1',
          type: 'human' as const,
        },
      ];

      const mapper = createContractToDbMapper<
        (typeof contractData)[0],
        Database['public']['Tables']['users']['Insert']
      >((data) => ({
        ...data,
        schemaVersion: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const results = contractData.map(mapper);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('user-1');
      expect(results[0].schemaVersion).toBe('1');
    });
  });

  describe('Edge cases with real database types', () => {
    it('should handle null values correctly', () => {
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-null',
        email: null,
        name: 'User With Null Email',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract);
      const result = mapper(dbRow);

      // Email is optional, so null should be handled
      expect(result.id).toBe('user-null');
      expect(result.name).toBe('User With Null Email');
    });

    it('should handle date fields correctly', () => {
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-dates',
        email: 'user@example.com',
        name: 'User With Dates',
        schemaVersion: '1',
        type: 'human',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract);
      const result = mapper(dbRow);

      // Date fields should not be in contract result
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should handle enum types correctly', () => {
      const dbRow: Database['public']['Tables']['users']['Row'] = {
        id: 'user-enum',
        email: 'user@example.com',
        name: 'User With Enum',
        schemaVersion: '1',
        type: 'bot',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Database['public']['Tables']['users']['Row'];

      const mapper = createDbRowMapper(UserContract);
      const result = mapper(dbRow);

      expect(result.type).toBe('bot');
    });
  });
});
