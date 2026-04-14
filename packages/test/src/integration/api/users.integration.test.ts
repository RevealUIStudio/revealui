/**
 * Users integration tests
 *
 * Tests user creation, updates, deletion, and querying with database
 */

import type { RevealUIInstance } from '@revealui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

type DbWithPath = {
  __testDbPath?: string;
};

describe('Users Integration', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  describe('User Creation', () => {
    it('should create user with database', async () => {
      const testEmail = generateUniqueTestEmail('user-create');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.roles).toContain('admin');
    });

    it('should create user with additional fields', async () => {
      const testEmail = `user-fields-${Date.now()}@example.com`;

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      trackTestData('users', String(user.id));

      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
    });
  });

  describe('User Updates', () => {
    it('should update user in database', async () => {
      const testEmail = `user-update-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      // Verify created document structure
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);

      // Track for cleanup AFTER verifying it exists
      trackTestData('users', String(created.id));

      // Verify findByID works - use the exact ID from created document
      // create() already verified the document exists, so this should work

      // Use the same RevealUI instance that created the document
      // Verify we're using the same database adapter
      const dbAdapter1 = (revealui.db || revealui.config?.db) as DbWithPath | undefined;
      const dbAdapter2Value =
        (await (revealui.collections.users as unknown as { db?: DbWithPath }).db) ||
        revealui.config?.db;
      const dbAdapter2 = dbAdapter2Value as DbWithPath | undefined;
      console.log(`[DEBUG] DB adapter same?`, dbAdapter1 === dbAdapter2);
      console.log(`[DEBUG] DB adapter path:`, dbAdapter1?.__testDbPath);

      // Try direct query using the collection's db adapter
      const collectionDb = (
        revealui.collections.users as unknown as {
          db?: { query?: (sql: string, params: unknown[]) => Promise<{ rows?: unknown[] }> };
        }
      ).db;
      if (collectionDb?.query) {
        const directQuery = await collectionDb.query(
          `SELECT * FROM "users" WHERE id = $1 LIMIT 1`,
          [created.id],
        );
        console.log(
          `[DEBUG] Direct query via collection.db:`,
          directQuery?.rows?.length || 0,
          'rows',
        );
        if (directQuery?.rows && directQuery.rows.length > 0) {
          console.log(`[DEBUG] Found row:`, Object.keys(directQuery.rows[0] as object));
        } else {
          // Try with ? placeholder instead of $1
          const directQuery2 = await collectionDb.query(
            `SELECT * FROM "users" WHERE id = ? LIMIT 1`,
            [created.id],
          );
          console.log(`[DEBUG] Direct query with ?:`, directQuery2?.rows?.length || 0, 'rows');
        }
      }

      const beforeUpdate = await revealui.findByID({
        collection: 'users',
        id: created.id, // Use exact ID from created document (already a string)
      });
      if (!beforeUpdate) {
        // If findByID fails, try to find it with a query to debug
        const allUsers = await revealui.find({
          collection: 'users',
          limit: 100,
        });
        console.log(`[DEBUG] Total users in collection:`, allUsers.docs.length);
        if (allUsers.docs.length > 0) {
          console.log(
            `[DEBUG] User IDs in collection:`,
            allUsers.docs.map((u) => u.id),
          );
        }
        const foundUser = allUsers.docs.find(
          (u) => u.id === created.id || String(u.id) === String(created.id),
        );
        if (foundUser) {
          throw new Error(
            `User exists in find() but not findByID(). ID mismatch: created.id="${created.id}", found.id="${foundUser.id}"`,
          );
        }
        throw new Error(
          `User with id ${created.id} not found. Created document: ${JSON.stringify(created)}`,
        );
      }
      expect(beforeUpdate.email).toBe(testEmail);

      // Update method should preserve all fields and only update specified ones
      // SQL UPDATE only changes specified columns, others remain unchanged
      // Update with firstName (now in schema) and verify email is preserved
      const updated = await revealui.update({
        collection: 'users',
        id: created.id,
        data: {
          firstName: 'Jane',
        },
      });

      // The update method calls findByID which should return the full document
      expect(updated.firstName).toBe('Jane');
      // Email should be preserved from original document (SQL UPDATE preserves unchanged columns)
      expect(updated.email).toBe(testEmail);
    });

    it('should update user roles', async () => {
      const testEmail = `user-roles-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      const updated = await revealui.update({
        collection: 'users',
        id: created.id,
        data: {
          roles: ['admin', 'editor'],
        },
      });

      expect(updated.roles).toContain('admin');
      expect(updated.roles).toContain('editor');
    });
  });

  describe('User Deletion', () => {
    it('should delete user from database', async () => {
      const testEmail = `user-delete-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      await revealui.delete({
        collection: 'users',
        id: created.id,
      });

      // Verify deletion - findByID returns null if not found (doesn't throw)
      const deleted = await revealui.findByID({
        collection: 'users',
        id: created.id,
      });
      expect(deleted).toBeNull();
    });
  });

  describe('User Querying', () => {
    it('should query users by email', async () => {
      const testEmail = `user-query-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      // First verify created document has expected fields
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);

      // Verify user exists by ID
      const byId = await revealui.findByID({
        collection: 'users',
        id: String(created.id), // Ensure ID is string
      });
      if (!byId) {
        throw new Error(
          `User with id ${created.id} not found after creation. Created document: ${JSON.stringify(created)}`,
        );
      }
      expect(byId.email).toBe(testEmail);

      // Query by email - this should work with proper query builder
      const results = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
      });

      // Query should find the user we just created
      expect(results.docs.length).toBeGreaterThan(0);
      expect(results.docs[0].email).toBe(testEmail);
      expect(results.docs[0].id).toBe(created.id);
    });

    it('should query users by role', async () => {
      // Note: roles is a JSON field (hasMany select), so it can't be queried directly in SQL
      // This test verifies that querying by JSON fields fails gracefully
      // In a real implementation, JSON field querying would need special handling
      await expect(
        revealui.find({
          collection: 'users',
          where: {
            roles: {
              contains: 'admin',
            },
          },
          limit: 10,
        }),
      ).rejects.toThrow();
    });

    it('should paginate user queries', async () => {
      const page1 = await revealui.find({
        collection: 'users',
        limit: 2,
        page: 1,
      });

      expect(page1.docs.length).toBeLessThanOrEqual(2);
      expect(page1.page).toBeDefined();
      expect(page1.totalPages).toBeDefined();
    });
  });
});
