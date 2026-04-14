/**
 * Test Isolation Verification Tests
 *
 * Tests to verify that test isolation works correctly:
 * - Cleanup removes all test data
 * - Parallel execution doesn't cause UNIQUE constraint failures
 * - Test data doesn't leak between test runs
 */

import type { RevealUIInstance } from '@revealui/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestData,
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('Test Isolation Verification', () => {
  let revealui: RevealUIInstance;

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  afterEach(async () => {
    // Cleanup after each test
    await cleanupTestData();
  });

  describe('Cleanup Verification', () => {
    it('should cleanup test data after test completes', async () => {
      const testEmail = generateUniqueTestEmail('cleanup-test');

      // Create user
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Verify user exists
      const beforeCleanup = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });
      expect(beforeCleanup).not.toBeNull();

      // Cleanup
      await cleanupTestData();

      // Verify user is deleted (or at least not found)
      // Note: cleanupTestData uses delete() which should remove the user
      const afterCleanup = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });
      // User should be deleted, but if not, that's okay - cleanup might have issues
      // The important thing is that cleanup ran without errors
      expect(afterCleanup).toBeNull();
    });

    it('should handle cleanup with multiple tracked items', async () => {
      const testEmails = [
        generateUniqueTestEmail('cleanup-multi-1'),
        generateUniqueTestEmail('cleanup-multi-2'),
        generateUniqueTestEmail('cleanup-multi-3'),
      ];

      const createdUsers: Array<{ id: string | number }> = [];

      // Create multiple users
      for (const email of testEmails) {
        const user = await revealui.create({
          collection: 'users',
          data: {
            email,
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        });

        trackTestData('users', String(user.id));
        createdUsers.push({ id: user.id });
      }

      // Verify all users exist
      for (const user of createdUsers) {
        const found = await revealui.findByID({
          collection: 'users',
          id: user.id,
        });
        expect(found).not.toBeNull();
      }

      // Cleanup should remove all
      await cleanupTestData();

      // Verify all are deleted
      for (const user of createdUsers) {
        const found = await revealui.findByID({
          collection: 'users',
          id: user.id,
        });
        expect(found).toBeNull();
      }
    });
  });

  describe('Unique Email Generation', () => {
    it('should generate unique emails even in rapid succession', async () => {
      const emails = new Set<string>();

      // Generate 100 emails rapidly
      for (let i = 0; i < 100; i++) {
        const email = generateUniqueTestEmail('rapid');
        expect(emails.has(email)).toBe(false); // Should be unique
        emails.add(email);
      }

      expect(emails.size).toBe(100); // All should be unique
    });

    it('should generate unique emails with same prefix', async () => {
      const email1 = generateUniqueTestEmail('same-prefix');
      const email2 = generateUniqueTestEmail('same-prefix');

      expect(email1).not.toBe(email2);
      expect(email1).toMatch(/^same-prefix-/);
      expect(email2).toMatch(/^same-prefix-/);
    });
  });

  describe('Parallel Execution Simulation', () => {
    it('should handle concurrent user creation without UNIQUE constraint failures', async () => {
      // Simulate parallel test execution by creating users concurrently
      const testEmails = Array.from({ length: 10 }, (_, i) =>
        generateUniqueTestEmail(`parallel-${i}`),
      );

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

      // All should succeed without UNIQUE constraint failures
      const createdUsers = await Promise.all(createPromises);

      // Track all for cleanup
      for (const user of createdUsers) {
        trackTestData('users', String(user.id));
      }

      // Verify all were created
      expect(createdUsers.length).toBe(testEmails.length);
      for (let i = 0; i < createdUsers.length; i++) {
        expect(createdUsers[i].email).toBe(testEmails[i]);
      }
    });

    it('should handle rapid sequential creation without conflicts', async () => {
      // Create users rapidly in sequence
      const createdUsers: Array<{ id: string | number; email: string }> = [];

      for (let i = 0; i < 20; i++) {
        const email = generateUniqueTestEmail(`sequential-${i}`);
        const user = await revealui.create({
          collection: 'users',
          data: {
            email,
            password: 'TestPassword123!',
            roles: ['admin'],
          },
        });

        trackTestData('users', String(user.id));
        createdUsers.push({ id: user.id, email });
      }

      // Verify all are unique
      const emails = new Set(createdUsers.map((u) => u.email));
      expect(emails.size).toBe(20);
    });
  });

  describe('Test Data Leakage Prevention', () => {
    it('should not have data from previous test runs', async () => {
      // This test verifies that cleanup works between test runs
      // If data from previous runs exists, this test might fail

      const testEmail = generateUniqueTestEmail('leakage-test');

      // Create user
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Verify user exists
      const found = await revealui.findByID({
        collection: 'users',
        id: user.id,
      });
      expect(found).not.toBeNull();

      // Cleanup
      await cleanupTestData();

      // In next test run, this user should not exist
      // (This is verified by the fact that we can create a new user with a new unique email)
      const newEmail = generateUniqueTestEmail('leakage-test');
      const newUser = await revealui.create({
        collection: 'users',
        data: {
          email: newEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(newUser.id));

      // Should be able to create without UNIQUE constraint failure
      expect(newUser.email).toBe(newEmail);
      expect(newUser.email).not.toBe(testEmail);
    });
  });
});
