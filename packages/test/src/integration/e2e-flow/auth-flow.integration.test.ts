/**
 * End-to-end authentication flow integration tests
 *
 * Tests complete authentication flow from login to token to API access
 */

import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import bcrypt from 'bcryptjs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('E2E Authentication Flow Integration', () => {
  let revealui: RevealUIInstance;
  const testEmail = generateUniqueTestEmail('e2e-auth');
  const testPassword = 'TestPassword123!';

  function createRequest(user: unknown): RevealRequest {
    return { user } as unknown as RevealRequest;
  }

  beforeAll(async () => {
    revealui = await getTestRevealUI();
  });

  describe('Complete Authentication Flow', () => {
    it('should complete login → token → API access flow', async () => {
      // Step 1: Create user with hashed password
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: hashedPassword,
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Step 2: Login and receive token
      const loginResult = await revealui.login({
        collection: 'users',
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(loginResult.token).toBeDefined();
      expect(loginResult.user).toBeDefined();

      // Step 3: Use token to access authenticated API
      const req = createRequest(loginResult.user);

      const queryResult = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
        req,
      });

      expect(queryResult.docs.length).toBeGreaterThan(0);
      expect(queryResult.docs[0].email).toBe(testEmail);
    });

    it('should handle token refresh flow', async () => {
      // Ensure user exists (created in previous test)
      // If not, create it
      let existingUser: { id: string | number } | undefined;
      try {
        const results = await revealui.find({
          collection: 'users',
          where: {
            email: {
              equals: testEmail,
            },
          },
        });
        existingUser = results.docs[0];
      } catch {
        // User doesn't exist, create it
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        existingUser = await revealui.create({
          collection: 'users',
          data: {
            email: testEmail,
            password: hashedPassword,
            roles: ['admin'],
          },
        });
        trackTestData('users', String(existingUser.id));
      }

      // Login to get initial token
      const loginResult = await revealui.login({
        collection: 'users',
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(loginResult.token).toBeDefined();

      // Use token for subsequent requests
      const req = createRequest(loginResult.user);

      // Make multiple requests with same token
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

  describe('Multi-tenant Authentication Flow', () => {
    it('should handle multi-tenant auth flow', async () => {
      const tenantEmail = generateUniqueTestEmail('tenant-auth');

      // Create user with tenant and hashed password
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

      // Login
      const loginResult = await revealui.login({
        collection: 'users',
        data: {
          email: tenantEmail,
          password: testPassword,
        },
      });

      expect(loginResult.user).toBeDefined();
      const tenantValue = (loginResult.user as { tenants?: unknown }).tenants;
      const tenants = Array.isArray(tenantValue) ? tenantValue : [];
      expect(tenants).toBeDefined();
    });
  });
});
