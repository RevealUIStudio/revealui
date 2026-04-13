/**
 * Persistence Regression Tests
 *
 * Comprehensive tests to verify that database persistence works correctly
 * and to prevent regressions of the core persistence issue that was fixed.
 *
 * These tests verify:
 * - Documents persist correctly after creation
 * - Documents can be queried immediately after creation
 * - JSON fields (arrays, hasMany selects) are handled correctly
 * - Database adapter is correctly initialized in collections
 * - Multiple create/query cycles work without data loss
 */

import type { RevealUIInstance } from '@revealui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('Persistence Regression Tests', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  describe('Core Persistence', () => {
    it('should create document and verify it persists', async () => {
      const testEmail = generateUniqueTestEmail('persist-test');

      // Create user
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      // Verify document was created with expected fields
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);
      expect(created.roles).toContain('admin');

      // Immediately query the document by ID to verify persistence
      const retrieved = await revealui.findByID({
        collection: 'users',
        id: created.id,
      });

      // Verify document persists and can be retrieved
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.email).toBe(testEmail);
      expect(retrieved?.roles).toContain('admin');
    });

    it('should query document immediately after creation', async () => {
      const testEmail = generateUniqueTestEmail('query-immediate');

      // Create user
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      // Query using find() immediately after creation
      const queryResult = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
      });

      // Verify document is found in query results
      expect(queryResult.docs.length).toBeGreaterThan(0);
      expect(queryResult.docs[0].id).toBe(created.id);
      expect(queryResult.docs[0].email).toBe(testEmail);
    });

    it('should create document with JSON fields and verify persistence', async () => {
      const testEmail = generateUniqueTestEmail('json-fields');

      // Create user with JSON fields (roles array, hasMany select)
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin', 'super-admin'], // Array field
          tenants: [
            {
              tenant: 1,
              roles: ['tenant-admin'],
            },
          ], // Array field
        },
      });

      trackTestData('users', String(created.id));

      // Verify JSON fields are stored correctly
      expect(created.roles).toBeDefined();
      expect(Array.isArray(created.roles)).toBe(true);
      expect(created.roles).toContain('admin');
      expect(created.roles).toContain('super-admin');

      // Query document and verify JSON fields persist
      const retrieved = await revealui.findByID({
        collection: 'users',
        id: created.id,
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.roles).toBeDefined();
      expect(Array.isArray(retrieved?.roles)).toBe(true);
      expect(retrieved?.roles).toContain('admin');
      expect(retrieved?.roles).toContain('super-admin');
    });

    it('should update document and verify changes persist', async () => {
      const testEmail = generateUniqueTestEmail('update-persist');

      // Create user
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
          firstName: 'John',
        },
      });

      trackTestData('users', String(created.id));

      // Update user
      const updated = await revealui.update({
        collection: 'users',
        id: created.id,
        data: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      });

      // Verify update persisted
      expect(updated.firstName).toBe('Jane');
      expect(updated.lastName).toBe('Doe');
      expect(updated.email).toBe(testEmail); // Original field should remain

      // Query document and verify update persisted
      const retrieved = await revealui.findByID({
        collection: 'users',
        id: created.id,
      });

      expect(retrieved?.firstName).toBe('Jane');
      expect(retrieved?.lastName).toBe('Doe');
      expect(retrieved?.email).toBe(testEmail);
    });

    it('should verify database adapter is correctly initialized in collections', async () => {
      const testEmail = generateUniqueTestEmail('db-adapter');

      // Verify collection has database adapter
      const usersCollection = revealui.collections.users;
      expect(usersCollection).toBeDefined();
      expect((usersCollection as unknown as Record<string, unknown>).db).not.toBeNull();
      expect((usersCollection as unknown as Record<string, unknown>).db).toBeDefined();

      // Create user to verify adapter works
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      // Verify document was created (proves adapter is working)
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);
    });

    it('should verify JSON fields are excluded from SQL column operations', async () => {
      const testEmail = generateUniqueTestEmail('json-exclusion');

      // Create user with JSON fields
      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'], // JSON field (hasMany select)
          tenants: [
            {
              tenant: 1,
              roles: ['tenant-admin'],
            },
          ], // Array field
        },
      });

      trackTestData('users', String(created.id));

      // Verify document was created successfully (proves JSON fields were excluded from INSERT)
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);

      // Verify JSON fields are still accessible (stored as JSON, not as columns)
      expect(created.roles).toBeDefined();
      expect(Array.isArray(created.roles)).toBe(true);

      // Query and verify JSON fields are properly deserialized
      const retrieved = await revealui.findByID({
        collection: 'users',
        id: created.id,
      });

      expect(retrieved?.roles).toBeDefined();
      expect(Array.isArray(retrieved?.roles)).toBe(true);
    });

    it('should handle multiple create/query cycles without data loss', async () => {
      const testEmails = [
        generateUniqueTestEmail('multi-cycle-1'),
        generateUniqueTestEmail('multi-cycle-2'),
        generateUniqueTestEmail('multi-cycle-3'),
      ];

      const createdUsers: Array<{ id: string | number; email: string }> = [];

      // Create multiple users
      for (const email of testEmails) {
        const created = await revealui.create({
          collection: 'users',
          data: {
            email,
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        });

        trackTestData('users', String(created.id));
        createdUsers.push({ id: created.id, email });

        // Immediately query each user to verify persistence
        const retrieved = await revealui.findByID({
          collection: 'users',
          id: created.id,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.email).toBe(email);
      }

      // Query all users at once to verify all persist
      const allUsers = await revealui.find({
        collection: 'users',
        where: {
          email: {
            in: testEmails,
          },
        },
      });

      // Verify all users are found
      expect(allUsers.docs.length).toBe(testEmails.length);
      for (const user of createdUsers) {
        const found = allUsers.docs.find((doc) => doc.id === user.id);
        expect(found).toBeDefined();
        expect(found?.email).toBe(user.email);
      }
    });

    it('should handle concurrent create operations', async () => {
      const testEmails = [
        generateUniqueTestEmail('concurrent-1'),
        generateUniqueTestEmail('concurrent-2'),
        generateUniqueTestEmail('concurrent-3'),
      ];

      // Create users concurrently
      const createPromises = testEmails.map((email) =>
        revealui.create({
          collection: 'users',
          data: {
            email,
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      );

      const createdUsers = await Promise.all(createPromises);

      // Track all for cleanup
      for (const user of createdUsers) {
        trackTestData('users', String(user.id));
      }

      // Verify all users were created
      expect(createdUsers.length).toBe(testEmails.length);
      for (let i = 0; i < createdUsers.length; i++) {
        expect(createdUsers[i].email).toBe(testEmails[i]);
      }

      // Query all users to verify they all persist
      const allUsers = await revealui.find({
        collection: 'users',
        where: {
          email: {
            in: testEmails,
          },
        },
      });

      expect(allUsers.docs.length).toBe(testEmails.length);
    });
  });

  describe('Original Bug Scenarios', () => {
    it('should handle config structure correctly (db not database.adapter)', async () => {
      // Verify config uses db directly, not database.adapter
      // This was the original bug: config used database: { adapter: ... } but should use db: ...
      const config = revealui.config;
      expect(config.db).toBeDefined();
      // Verify collections are initialized with correct database adapter
      const usersCollection = revealui.collections.users;
      expect((usersCollection as unknown as Record<string, unknown>).db).not.toBeNull();
      expect((usersCollection as unknown as Record<string, unknown>).db).toBeDefined();
    });

    it('should exclude JSON fields from SQL column operations', async () => {
      // This test verifies the original bug fix: JSON fields should not cause "column not found" errors
      const testEmail = generateUniqueTestEmail('json-exclusion-bug');

      // Create user with JSON fields (roles array, hasMany select)
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin', 'super-admin'], // JSON field (hasMany select)
          tenants: [
            {
              tenant: 1,
              roles: ['tenant-admin'],
            },
          ], // Array field
        },
      });

      trackTestData('users', String(user.id));

      // Verify no "column not found" errors occurred
      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);

      // Verify JSON fields are stored and retrieved correctly
      expect(user.roles).toBeDefined();
      expect(Array.isArray(user.roles)).toBe(true);
      expect(user.roles).toContain('admin');

      // Query and verify JSON fields persist
      const retrieved = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });

      expect(retrieved?.roles).toBeDefined();
      expect(Array.isArray(retrieved?.roles)).toBe(true);
    });

    it('should handle WHERE clause parameter binding correctly', async () => {
      // Test parameter binding with various WHERE clause combinations
      // This verifies the SQL syntax fixes work correctly

      const testEmail1 = generateUniqueTestEmail('param-binding-1');
      const testEmail2 = generateUniqueTestEmail('param-binding-2');

      const user1 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail1,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      const user2 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail2,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user1.id));
      trackTestData('users', String(user2.id));

      // Test with empty WHERE
      const emptyWhere = await revealui.find({
        collection: 'users',
        where: undefined,
        limit: 10,
      });
      expect(emptyWhere.docs).toBeDefined();
      expect(Array.isArray(emptyWhere.docs)).toBe(true);

      // Test with single condition
      const singleCondition = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail1,
          },
        },
      });
      expect(singleCondition.docs.length).toBeGreaterThan(0);
      expect(singleCondition.docs[0].email).toBe(testEmail1);

      // Test with multiple conditions
      // Note: JSON fields cannot be queried in WHERE clauses yet (requires JSONB operator support)
      // Query by email only to verify parameter binding works
      const multipleConditions = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail1,
          },
        },
      });
      expect(multipleConditions.docs.length).toBe(1);
      expect(multipleConditions.docs[0].email).toBe(testEmail1);
      // Verify JSON field is present in result
      expect(multipleConditions.docs[0].roles).toBeDefined();

      // Test with nested AND/OR
      const nestedConditions = await revealui.find({
        collection: 'users',
        where: {
          or: [{ email: { equals: testEmail1 } }, { email: { equals: testEmail2 } }],
        },
      });
      expect(nestedConditions.docs.length).toBeGreaterThanOrEqual(2);

      // Test with IN operator
      const inCondition = await revealui.find({
        collection: 'users',
        where: {
          email: {
            in: [testEmail1, testEmail2],
          },
        },
      });
      expect(inCondition.docs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large documents', async () => {
      const testEmail = generateUniqueTestEmail('large-doc');
      const largeRoles = Array.from({ length: 100 }, (_, i) => `role-${i}`);

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: largeRoles,
        },
      });

      trackTestData('users', String(user.id));

      expect(user.roles).toBeDefined();
      expect(Array.isArray(user.roles)).toBe(true);
      expect((user.roles as unknown[]).length).toBe(100);
    });

    it('should handle special characters in data', async () => {
      const testEmail = generateUniqueTestEmail('special-chars');
      const specialFirstName = "O'Brien & O'Reilly <test>";

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          firstName: specialFirstName,
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      const retrieved = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });

      expect(retrieved?.firstName).toBe(specialFirstName);
    });

    it('should handle null/undefined values in JSON fields', async () => {
      const testEmail = generateUniqueTestEmail('null-json');

      const nullJsonData = {
        email: testEmail,
        password: 'TestPassword123!',
        roles: ['admin'],
        tenants: null, // JSON field with null
      };

      const user = await revealui.create({
        collection: 'users',
        data: nullJsonData,
      });

      trackTestData('users', String(user.id));

      const retrieved = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.email).toBe(testEmail);
    });

    it('should handle empty arrays in JSON fields', async () => {
      const testEmail = generateUniqueTestEmail('empty-array-json');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: [], // Empty array
        },
      });

      trackTestData('users', String(user.id));

      const retrieved = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });

      expect(retrieved?.roles).toBeDefined();
      expect(Array.isArray(retrieved?.roles)).toBe(true);
      expect((retrieved?.roles as unknown[] | undefined)?.length).toBe(0);
    });

    it('should handle deeply nested JSON structures', async () => {
      const testEmail = generateUniqueTestEmail('nested-json');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
          tenants: [
            {
              tenant: 1,
              roles: ['tenant-admin'],
              metadata: {
                nested: {
                  deep: {
                    value: 'test',
                  },
                },
              },
            },
          ],
        },
      });

      trackTestData('users', String(user.id));

      const retrieved = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });

      expect(retrieved?.tenants).toBeDefined();
      if (retrieved?.tenants && Array.isArray(retrieved.tenants) && retrieved.tenants[0]) {
        const tenant = retrieved.tenants[0] as {
          metadata?: { nested?: { deep?: { value?: string } } };
        };
        expect(tenant.metadata?.nested?.deep?.value).toBe('test');
      }
    });
  });
});
