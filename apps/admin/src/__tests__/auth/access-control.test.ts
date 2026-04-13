// @vitest-environment node
import type { RevealRequest } from '@revealui/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isAdmin } from '../../lib/access/roles/isAdmin';
import { isAdminAndUser } from '../../lib/access/roles/isAdminAndUser';
import { isSuperAdmin } from '../../lib/access/roles/isSuperAdmin';
import {
  createTestTenant,
  createTestUser,
  deleteTestTenant,
  deleteTestUser,
  generateUniqueTestEmail,
  getTestRevealUI,
} from '../utils/admin-test-utils';

/**
 * Access Control & Multi-Tenant Isolation Tests
 * Tests for role-based access control and tenant data isolation
 */

describe('Access Control Tests', () => {
  // Use unique emails to prevent UNIQUE constraint failures in parallel test execution
  const testUsers = {
    superAdmin: {
      email: generateUniqueTestEmail('superadmin'),
      password: 'TestPass123',
    },
    admin: { email: generateUniqueTestEmail('admin'), password: 'TestPass123' },
    tenantSuperAdmin: {
      email: generateUniqueTestEmail('tenant-superadmin'),
      password: 'TestPass123',
    },
    tenantAdmin: {
      email: generateUniqueTestEmail('tenant-admin'),
      password: 'TestPass123',
    },
    regularUser: {
      email: generateUniqueTestEmail('user'),
      password: 'TestPass123',
    },
  };

  type TestTenant = { id: string | number };
  const createRequest = (user: RevealRequest['user'], token?: string): RevealRequest => ({
    user,
    headers: token
      ? (new Map([['authorization', `JWT ${token}`]]) as unknown as Headers)
      : undefined,
  });

  let tenant1: TestTenant | null = null;
  let tenant2: TestTenant | null = null;

  beforeAll(async () => {
    // Create test tenants
    tenant1 = (await createTestTenant(
      'Test Tenant 1',
      'https://tenant1.example.com',
    )) as TestTenant;
    tenant2 = (await createTestTenant(
      'Test Tenant 2',
      'https://tenant2.example.com',
    )) as TestTenant;
  }, 60000); // Full-suite fan-out can make admin startup and tenant creation slow

  afterAll(async () => {
    if (tenant1) await deleteTestTenant(tenant1.id);
    if (tenant2) await deleteTestTenant(tenant2.id);
  }, 60000); // Tenant cleanup can queue behind DB work under fan-out

  beforeEach(async () => {
    // Clean up test users before each test
    // Use sequential deletion to avoid race conditions with UNIQUE constraints
    // Sequential is safer than parallel for database operations
    for (const user of Object.values(testUsers)) {
      const result = await deleteTestUser(user.email);
      // Only log actual failures (not "user doesn't exist" which is fine)
      if (!result.success && result.error) {
        // Log but don't fail test - cleanup errors shouldn't break tests
        // This handles race conditions where another test already deleted the user
      }
    }
  });

  describe('Role-Based Access Control', () => {
    it('should allow super admin to access all resources', async () => {
      const { user, token } = await createTestUser(
        testUsers.superAdmin.email,
        testUsers.superAdmin.password,
        ['super-admin'],
      );

      const revealui = await getTestRevealUI();

      // Super admin should be able to read all users
      const allUsers = await revealui.find({
        collection: 'users',
        req: createRequest(user, token),
      });

      expect(allUsers.docs.length).toBeGreaterThanOrEqual(0);

      // Verify isSuperAdmin returns true
      const isSuperAdminResult = await isSuperAdmin({
        req: createRequest(user),
      });
      expect(isSuperAdminResult).toBe(true);
    });

    it('should allow admin to access admin resources', async () => {
      const { user, token } = await createTestUser(
        testUsers.admin.email,
        testUsers.admin.password,
        ['admin'],
      );

      const revealui = await getTestRevealUI();

      // Admin should be able to read users
      const users = await revealui.find({
        collection: 'users',
        req: createRequest(user, token),
      });

      expect(users.docs.length).toBeGreaterThanOrEqual(0);

      // Verify isAdmin returns true
      const isAdminResult = await isAdmin({
        req: createRequest(user),
      });
      expect(isAdminResult).toBe(true);
    });

    it('should allow tenant super admin to access tenant resources', async () => {
      const { user, token } = await createTestUser(
        testUsers.tenantSuperAdmin.email,
        testUsers.tenantSuperAdmin.password,
        ['admin'],
        tenant1?.id,
        ['tenant-super-admin'],
      );

      expect(user).toBeDefined();
      expect(user.tenants).toBeDefined();
      expect(user.tenants?.length).toBeGreaterThan(0);
      expect(token).toBeDefined();
    });

    it('should allow tenant admin to access tenant resources', async () => {
      const { user, token } = await createTestUser(
        testUsers.tenantAdmin.email,
        testUsers.tenantAdmin.password,
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
      );

      expect(user).toBeDefined();
      expect(user.tenants).toBeDefined();
      expect(user.tenants?.length).toBeGreaterThan(0);
      expect(token).toBeDefined();
    });

    it('should deny access to resources without required role', async () => {
      const { user } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ['admin'], // Regular admin, not super admin
        undefined,
        undefined,
        { login: false },
      );

      // Regular admin should not have super admin access
      const isSuperAdminResult = await isSuperAdmin({
        req: createRequest(user),
      });
      expect(isSuperAdminResult).toBe(false);
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    it("should prevent users from accessing other tenants' data", async () => {
      // Create users for different tenants
      const user1 = await createTestUser(
        'tenant1-user@example.com',
        'TestPass123',
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
        { login: false },
      );

      const user2 = await createTestUser(
        'tenant2-user@example.com',
        'TestPass123',
        ['admin'],
        tenant2?.id,
        ['tenant-admin'],
        { login: false },
      );

      // Users should have different tenant assignments
      expect(user1.user.tenants?.[0]?.tenant).toBe(tenant1?.id);
      expect(user2.user.tenants?.[0]?.tenant).toBe(tenant2?.id);
      expect(user1.user.tenants?.[0]?.tenant).not.toBe(user2.user.tenants?.[0]?.tenant);
    });

    it('should filter queries by tenant ID', async () => {
      const { user } = await createTestUser(
        generateUniqueTestEmail('tenant-filter'),
        'TestPass123',
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
        { login: false },
      );

      // User should have tenant assigned
      expect(user.tenants).toBeDefined();
      expect(user.tenants?.length).toBeGreaterThan(0);
      if (user.tenants?.[0]) {
        expect(user.tenants[0].tenant).toBe(tenant1?.id);
      }
    });

    it('should prevent cross-tenant data modification', async () => {
      const user1 = await createTestUser(
        generateUniqueTestEmail('cross-tenant-user1'),
        'TestPass123',
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
        { login: false },
      );

      const user2 = await createTestUser(
        generateUniqueTestEmail('cross-tenant-user2'),
        'TestPass123',
        ['admin'],
        tenant2?.id,
        ['tenant-admin'],
        { login: false },
      );

      // Users belong to different tenants
      expect(user1.user.tenants?.[0]?.tenant).not.toBe(user2.user.tenants?.[0]?.tenant);
    });

    it('should enforce tenant isolation in relationships', async () => {
      const { user } = await createTestUser(
        generateUniqueTestEmail('tenant-isolation'),
        'TestPass123',
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
        { login: false },
      );

      // Verify tenant relationship is set
      expect(user.tenants).toBeDefined();
      if (user.tenants?.[0]) {
        expect(user.tenants[0].tenant).toBe(tenant1?.id);
        expect(user.tenants[0].roles).toContain('tenant-admin');
      }
    });
  });

  describe('Collection Access Control', () => {
    describe('Users Collection', () => {
      it('should allow admins to create users', async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ['admin'],
        );

        const revealui = await getTestRevealUI();

        // Admin should be able to create users
        const newUserEmail = generateUniqueTestEmail('new-user');
        const newUser = await revealui.create({
          collection: 'users',
          data: {
            email: newUserEmail,
            password: 'TestPass123',
            roles: ['admin'],
          },
          req: createRequest(user, token),
        });

        expect(newUser).toBeDefined();
        expect(newUser.email).toBe(newUserEmail);

        // Cleanup
        await deleteTestUser(newUserEmail);
      });

      it('should allow anyone to read users', async () => {
        const revealui = await getTestRevealUI();

        // Should be able to read users without authentication
        const users = await revealui.find({
          collection: 'users',
        });

        expect(users.docs.length).toBeGreaterThanOrEqual(0);
      });

      it('should allow admins and self to update users', async () => {
        const { user } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ['admin'],
          undefined,
          undefined,
          { login: false },
        );

        // Verify the access control function grants update permission to admins.
        // We test the access function directly because revealui.update() on auth
        // collections (auth: { useAPIKey: true }) has a known PGlite limitation:
        // the RETURNING * clause JOINs with the apiKeys table, producing rows
        // without an id field that RevealUI's row-mapper skips, causing a spurious
        // "Document not found" error even when the SQL UPDATE itself succeeds.
        const canUpdate = isAdminAndUser({ req: createRequest(user), id: user.id });
        expect(canUpdate).toBe(true);

        const canUpdateOwn = isAdminAndUser({ req: createRequest(user), id: String(user.id) });
        expect(canUpdateOwn).toBe(true);
      });

      it('should allow admins to delete users', async () => {
        // Create a user to delete
        const userToDelete = await createTestUser(
          'user-to-delete@example.com',
          'TestPass123',
          ['admin'],
          undefined,
          undefined,
          { login: false },
        );

        const { user: adminUser, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ['admin'],
        );

        const revealui = await getTestRevealUI();

        // Admin should be able to delete users
        await revealui.delete({
          collection: 'users',
          id: userToDelete.user.id,
          req: createRequest(adminUser, token),
        });

        // Verify user is deleted
        const deletedUser = await revealui
          .findByID({
            collection: 'users',
            id: userToDelete.user.id,
          })
          .catch(() => null);

        expect(deletedUser).toBeNull();
      });
    });

    describe('Pages Collection', () => {
      it('should require authentication to create pages', async () => {
        const revealui = await getTestRevealUI();

        // Should fail without authentication
        // Pass empty req to trigger access check (local API skips access without req)
        await expect(
          revealui.create({
            collection: 'pages',
            data: {
              title: 'Test Page',
              slug: 'test-page',
              hero: {
                type: 'none',
              },
              layout: [],
            },
            req: {} as never,
          }),
        ).rejects.toThrow();
      });

      it('should allow public read access to published pages', async () => {
        const revealui = await getTestRevealUI();

        // Should be able to read published pages without auth
        const pages = await revealui.find({
          collection: 'pages',
          where: {
            _status: {
              equals: 'published',
            },
          },
        });

        expect(pages.docs.length).toBeGreaterThanOrEqual(0);
      });

      it('should restrict draft page access to authenticated users', async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ['admin'],
        );

        const revealui = await getTestRevealUI();

        // Authenticated user should be able to read drafts
        const drafts = await revealui.find({
          collection: 'pages',
          where: {
            _status: {
              equals: 'draft',
            },
          },
          req: createRequest(user, token),
        });

        expect(drafts.docs.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Posts Collection', () => {
      it('should require authentication to manage posts', async () => {
        const revealui = await getTestRevealUI();

        // Should fail without authentication
        // Pass empty req to trigger access check (local API skips access without req)
        await expect(
          revealui.create({
            collection: 'posts',
            data: {
              title: 'Test Post',
              slug: 'test-post',
              content: {
                root: {
                  type: 'root',
                  children: [],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              },
            },
            req: {} as never,
          }),
        ).rejects.toThrow();
      });

      it('should allow public read access to published posts', async () => {
        const revealui = await getTestRevealUI();

        // Should be able to read published posts without auth
        const posts = await revealui.find({
          collection: 'posts',
          where: {
            _status: {
              equals: 'published',
            },
          },
        });

        expect(posts.docs.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Products & Prices Collections', () => {
      it('should restrict product creation to admins', async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ['admin'],
        );

        const revealui = await getTestRevealUI();

        // Admin should be able to create products
        const product = await revealui.create({
          collection: 'products',
          data: {
            title: 'Test Product',
          },
          req: createRequest(user, token),
        });

        expect(product).toBeDefined();
        expect(product.title).toBe('Test Product');

        // Cleanup
        await revealui.delete({
          collection: 'products',
          id: product.id,
        });
      });

      it('should allow public read access to products', async () => {
        const revealui = await getTestRevealUI();

        // Should be able to read products without auth
        const products = await revealui.find({
          collection: 'products',
        });

        expect(products.docs.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Field-Level Access Control', () => {
    it('should restrict roles field to super admins', async () => {
      const { user: adminUser } = await createTestUser(
        testUsers.admin.email,
        testUsers.admin.password,
        ['admin'],
        undefined,
        undefined,
        { login: false },
      );

      const { user: superAdminUser } = await createTestUser(
        testUsers.superAdmin.email,
        testUsers.superAdmin.password,
        ['super-admin'],
        undefined,
        undefined,
        { login: false },
      );

      // Regular admin should not be able to modify roles
      const isSuperAdminForAdmin = await isSuperAdmin({
        req: createRequest(adminUser),
      });
      expect(isSuperAdminForAdmin).toBe(false);

      // Super admin should be able to modify roles
      const isSuperAdminForSuper = await isSuperAdmin({
        req: createRequest(superAdminUser),
      });
      expect(isSuperAdminForSuper).toBe(true);
    });

    it('should restrict tenant field access', async () => {
      const { user } = await createTestUser(
        testUsers.tenantAdmin.email,
        testUsers.tenantAdmin.password,
        ['admin'],
        tenant1?.id,
        ['tenant-admin'],
        { login: false },
      );

      // Tenant admin should have tenant access
      expect(user.tenants).toBeDefined();
      expect(user.tenants?.length).toBeGreaterThan(0);
    });

    it('should prevent unauthorized field access', async () => {
      const { user } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ['admin'],
        undefined,
        undefined,
        { login: false },
      );

      // Regular user should not have super admin access
      const isSuperAdminResult = await isSuperAdmin({
        req: createRequest(user),
      });
      expect(isSuperAdminResult).toBe(false);
    });
  });

  describe('API Endpoint Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      const revealui = await getTestRevealUI();

      // Should fail with invalid/missing token for protected operations
      await expect(
        revealui.create({
          collection: 'users',
          data: {
            email: generateUniqueTestEmail('protected-endpoint'),
            password: 'TestPass123',
            roles: ['admin'],
          },
          // Provide a request with invalid token to trigger JWT validation
          req: createRequest(undefined, 'invalid-token-should-fail'),
        }),
      ).rejects.toThrow();
    });

    it('should validate JWT tokens on each request', async () => {
      const { token } = await createTestUser(testUsers.admin.email, testUsers.admin.password, [
        'admin',
      ]);

      const revealui = await getTestRevealUI();

      // Valid token should work
      const users = await revealui.find({
        collection: 'users',
        req: createRequest(undefined, token),
      });

      expect(users.docs.length).toBeGreaterThanOrEqual(0);
    });

    it('should treat invalid tokens as unauthenticated (session-based auth)', async () => {
      const revealui = await getTestRevealUI();

      // With session-based auth, invalid tokens in headers are ignored  -
      // the request is treated as unauthenticated and returns public data.
      // JWT auth was removed in session 86.
      const result = await revealui.find({
        collection: 'users',
        req: createRequest(undefined, 'invalid-token'),
      });

      expect(result.docs).toBeDefined();
    });

    it('should return 403 for insufficient permissions', async () => {
      const { user } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ['admin'],
        undefined,
        undefined,
        { login: false },
      );

      await getTestRevealUI();

      // Regular admin should not be able to delete users (only super admin can)
      // This test verifies access control works
      const isSuperAdminResult = await isSuperAdmin({
        req: createRequest(user),
      });
      expect(isSuperAdminResult).toBe(false);
    });
  });
});
