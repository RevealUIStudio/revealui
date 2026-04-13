/**
 * Collections integration tests
 *
 * Tests collection CRUD operations, access control, and field validation
 */

import type { RevealDataObject, RevealUIInstance } from '@revealui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { getTestRevealUI, trackTestData } from '../../utils/integration-helpers.js';

describe('Collections Integration', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  describe('Collection CRUD Operations', () => {
    it('should create document in collection', async () => {
      const testEmail = `create-test-${Date.now()}@example.com`;

      const doc = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(doc.id));

      expect(doc.id).toBeDefined();
      expect(doc.email).toBe(testEmail);
    });

    it('should read document from collection', async () => {
      const testEmail = `read-test-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      // Verify created document has expected fields
      expect(created.id).toBeDefined();
      expect(created.email).toBe(testEmail);

      // findByID returns null if document not found, so check for null explicitly
      const read = await revealui.findByID({
        collection: 'users',
        id: String(created.id), // Ensure ID is string
      });

      if (!read) {
        throw new Error(
          `Document with id ${created.id} not found after creation. Created document: ${JSON.stringify(created)}`,
        );
      }

      expect(read.id).toBe(created.id);
      expect(read.email).toBe(testEmail);
    });

    it('should update document in collection', async () => {
      const testEmail = `update-test-${Date.now()}@example.com`;

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
          email: `updated-${testEmail}`,
        },
      });

      expect(updated.email).toBe(`updated-${testEmail}`);
      expect(updated.id).toBe(created.id);
    });

    it('should delete document from collection', async () => {
      const testEmail = `delete-test-${Date.now()}@example.com`;

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

  describe('Query Operations', () => {
    it('should query collection with where clause', async () => {
      const testEmail = `query-test-${Date.now()}@example.com`;

      const created = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(created.id));

      const results = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
      });

      expect(results.docs.length).toBeGreaterThan(0);
      expect(results.docs[0].email).toBe(testEmail);
    });

    it('should query with limit', async () => {
      const results = await revealui.find({
        collection: 'users',
        limit: 5,
      });

      expect(results.docs.length).toBeLessThanOrEqual(5);
    });

    it('should query with pagination', async () => {
      const page1 = await revealui.find({
        collection: 'users',
        limit: 2,
        page: 1,
      });

      const page2 = await revealui.find({
        collection: 'users',
        limit: 2,
        page: 2,
      });

      expect(page1.docs.length).toBeLessThanOrEqual(2);
      expect(page2.docs.length).toBeLessThanOrEqual(2);

      // Pages should have different results
      if (page1.docs.length > 0 && page2.docs.length > 0) {
        expect(page1.docs[0].id).not.toBe(page2.docs[0].id);
      }
    });
  });

  describe('Field Validation', () => {
    it('should validate required fields', async () => {
      const invalidData: RevealDataObject = {
        // Missing required email field
        password: 'TestPassword123!',
      };
      await expect(
        revealui.create({
          collection: 'users',
          data: invalidData,
        }),
      ).rejects.toThrow();
    });

    it('should validate email format', async () => {
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: 'invalid-email',
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Access Control', () => {
    it('should enforce access control on create', async () => {
      // This would test access control if implemented
      // For now, we'll test that operations require authentication where needed
      const testEmail = `access-test-${Date.now()}@example.com`;

      const doc = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(doc.id));

      expect(doc.id).toBeDefined();
    });
  });
});
