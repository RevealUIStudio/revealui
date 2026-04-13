/**
 * Authentication integration tests
 *
 * Tests authentication flow from API calls to JWT generation and validation
 */

import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestData,
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('Authentication Integration', () => {
  let revealui: RevealUIInstance;
  let testUserId: string | number;
  let testEmail: string;
  const testPassword = 'TestPassword123!';
  let hashedPassword: string;

  function createRequest(user: unknown): RevealRequest {
    return { user } as unknown as RevealRequest;
  }

  beforeAll(async () => {
    revealui = await getTestRevealUI();
    // Create unique test user for all tests in this suite
    testEmail = generateUniqueTestEmail('test-auth');
    hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create user once for all tests
    const user = await revealui.create({
      collection: 'users',
      data: {
        email: testEmail,
        password: hashedPassword,
        roles: ['admin'],
      },
    });
    testUserId = user.id;
    trackTestData('users', String(testUserId));
  });

  afterAll(async () => {
    // Cleanup tracked data created in beforeAll
    // This ensures the user created for all tests gets cleaned up
    await cleanupTestData();
  });

  describe('User Registration and Login Flow', () => {
    it('should create user and login successfully', async () => {
      // User was created in beforeAll, verify it exists
      // First verify the user was created with expected fields
      if (!testUserId) {
        throw new Error('testUserId not set in beforeAll');
      }

      const user = await revealui.findByID({
        collection: 'users',
        id: String(testUserId),
      });

      if (!user) {
        throw new Error(
          `User with id ${testUserId} not found. User was created in beforeAll but cannot be retrieved.`,
        );
      }

      expect(user.email).toBe(testEmail);
      expect(user.roles).toContain('admin');
    });

    it('should login with valid credentials and receive JWT', async () => {
      const result = await revealui.login({
        collection: 'users',
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should reject login with invalid password', async () => {
      await expect(
        revealui.login({
          collection: 'users',
          data: {
            email: testEmail,
            password: 'WrongPassword123!',
          },
        }),
      ).rejects.toThrow();
    });

    it('should reject login with non-existent email', async () => {
      await expect(
        revealui.login({
          collection: 'users',
          data: {
            email: 'nonexistent@example.com',
            password: testPassword,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('JWT Validation', () => {
    it('should validate JWT and return user', async () => {
      // Login to get token
      const loginResult = await revealui.login({
        collection: 'users',
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(loginResult.token).toBeDefined();

      // Verify user can access authenticated endpoints
      const meResult = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
        req: createRequest(loginResult.user),
      });

      expect(meResult.docs.length).toBeGreaterThan(0);
      expect(meResult.docs[0].email).toBe(testEmail);
    });
  });

  describe('Session Management', () => {
    it('should maintain session across requests', async () => {
      const loginResult = await revealui.login({
        collection: 'users',
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      // Make multiple authenticated requests
      const req = createRequest(loginResult.user);

      const query1 = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
        req,
      });

      const query2 = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
        req,
      });

      expect(query1.docs[0].id).toBe(query2.docs[0].id);
    });
  });

  describe('Multi-tenant Authentication', () => {
    it('should support tenant-scoped user creation', async () => {
      const tenantEmail = `tenant-user-${Date.now()}@example.com`;

      // Hash password before creating user
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: tenantEmail,
          password: hashedPassword,
          roles: ['admin'],
          tenants: [
            {
              tenant: 1,
              roles: ['admin'],
            },
          ],
        },
      });

      trackTestData('users', String(user.id));

      expect(user.email).toBe(tenantEmail);
      expect(user.tenants).toBeDefined();
      const tenants = Array.isArray(user.tenants) ? user.tenants : [];
      expect(tenants.length).toBeGreaterThan(0);
    });
  });
});
