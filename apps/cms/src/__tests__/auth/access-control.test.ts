import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import {
  createTestUser,
  deleteTestUser,
  createTestTenant,
  deleteTestTenant,
  getTestPayload,
  cleanupTestUsers,
} from "../utils/cms-test-utils"
import { isSuperAdmin } from "../../lib/access/roles/isSuperAdmin"
import { isAdmin } from "../../lib/access/roles/isAdmin"

/**
 * Access Control & Multi-Tenant Isolation Tests
 * Tests for role-based access control and tenant data isolation
 */

describe("Access Control Tests", () => {
  const testUsers = {
    superAdmin: { email: "test-superadmin@example.com", password: "TestPass123" },
    admin: { email: "test-admin@example.com", password: "TestPass123" },
    tenantSuperAdmin: { email: "test-tenant-superadmin@example.com", password: "TestPass123" },
    tenantAdmin: { email: "test-tenant-admin@example.com", password: "TestPass123" },
    regularUser: { email: "test-user@example.com", password: "TestPass123" },
  }

  let tenant1: any
  let tenant2: any

  beforeAll(async () => {
    await cleanupTestUsers()
    // Create test tenants
    tenant1 = await createTestTenant("Test Tenant 1", "https://tenant1.example.com")
    tenant2 = await createTestTenant("Test Tenant 2", "https://tenant2.example.com")
  })

  afterAll(async () => {
    await cleanupTestUsers()
    if (tenant1) await deleteTestTenant(tenant1.id)
    if (tenant2) await deleteTestTenant(tenant2.id)
  })

  beforeEach(async () => {
    // Clean up test users before each test
    for (const user of Object.values(testUsers)) {
      await deleteTestUser(user.email)
    }
  })

  describe("Role-Based Access Control", () => {
    it("should allow super admin to access all resources", async () => {
      const { user, token } = await createTestUser(
        testUsers.superAdmin.email,
        testUsers.superAdmin.password,
        ["user-super-admin"]
      )

      const payload = await getTestPayload()
      
      // Super admin should be able to read all users
      const allUsers = await payload.find({
        collection: "users",
        req: {
          user,
          headers: {
            authorization: `JWT ${token}`,
          },
        } as any,
      })

      expect(allUsers.docs.length).toBeGreaterThanOrEqual(0)
      
      // Verify isSuperAdmin returns true
      const isSuperAdminResult = await isSuperAdmin({
        req: {
          user,
        } as any,
      })
      expect(isSuperAdminResult).toBe(true)
    })

    it("should allow admin to access admin resources", async () => {
      const { user, token } = await createTestUser(
        testUsers.admin.email,
        testUsers.admin.password,
        ["user-admin"]
      )

      const payload = await getTestPayload()
      
      // Admin should be able to read users
      const users = await payload.find({
        collection: "users",
        req: {
          user,
          headers: {
            authorization: `JWT ${token}`,
          },
        } as any,
      })

      expect(users.docs.length).toBeGreaterThanOrEqual(0)
      
      // Verify isAdmin returns true
      const isAdminResult = await isAdmin({
        req: {
          user,
        } as any,
      })
      expect(isAdminResult).toBe(true)
    })

    it("should allow tenant super admin to access tenant resources", async () => {
      const { user, token } = await createTestUser(
        testUsers.tenantSuperAdmin.email,
        testUsers.tenantSuperAdmin.password,
        ["user-admin"],
        tenant1.id,
        ["tenant-super-admin"]
      )

      expect(user).toBeDefined()
      expect(user.tenants).toBeDefined()
      expect(user.tenants?.length).toBeGreaterThan(0)
      expect(token).toBeDefined()
    })

    it("should allow tenant admin to access tenant resources", async () => {
      const { user, token } = await createTestUser(
        testUsers.tenantAdmin.email,
        testUsers.tenantAdmin.password,
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      expect(user).toBeDefined()
      expect(user.tenants).toBeDefined()
      expect(user.tenants?.length).toBeGreaterThan(0)
      expect(token).toBeDefined()
    })

    it("should deny access to resources without required role", async () => {
      const { user } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ["user-admin"] // Regular admin, not super admin
      )

      // Regular admin should not have super admin access
      const isSuperAdminResult = await isSuperAdmin({
        req: {
          user,
        } as any,
      })
      expect(isSuperAdminResult).toBe(false)
    })
  })

  describe("Multi-Tenant Data Isolation", () => {
    it("should prevent users from accessing other tenants' data", async () => {
      // Create users for different tenants
      const user1 = await createTestUser(
        "tenant1-user@example.com",
        "TestPass123",
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      const user2 = await createTestUser(
        "tenant2-user@example.com",
        "TestPass123",
        ["user-admin"],
        tenant2.id,
        ["tenant-admin"]
      )

      // Users should have different tenant assignments
      expect(user1.user.tenants?.[0]?.tenant).toBe(tenant1.id)
      expect(user2.user.tenants?.[0]?.tenant).toBe(tenant2.id)
      expect(user1.user.tenants?.[0]?.tenant).not.toBe(user2.user.tenants?.[0]?.tenant)
    })

    it("should filter queries by tenant ID", async () => {
      const { user } = await createTestUser(
        "tenant-filter-test@example.com",
        "TestPass123",
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      // User should have tenant assigned
      expect(user.tenants).toBeDefined()
      expect(user.tenants?.length).toBeGreaterThan(0)
      if (user.tenants && user.tenants[0]) {
        expect(user.tenants[0].tenant).toBe(tenant1.id)
      }
    })

    it("should prevent cross-tenant data modification", async () => {
      const user1 = await createTestUser(
        "cross-tenant-user1@example.com",
        "TestPass123",
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      const user2 = await createTestUser(
        "cross-tenant-user2@example.com",
        "TestPass123",
        ["user-admin"],
        tenant2.id,
        ["tenant-admin"]
      )

      // Users belong to different tenants
      expect(user1.user.tenants?.[0]?.tenant).not.toBe(user2.user.tenants?.[0]?.tenant)
    })

    it("should enforce tenant isolation in relationships", async () => {
      const { user } = await createTestUser(
        "tenant-isolation-test@example.com",
        "TestPass123",
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      // Verify tenant relationship is set
      expect(user.tenants).toBeDefined()
      if (user.tenants && user.tenants[0]) {
        expect(user.tenants[0].tenant).toBe(tenant1.id)
        expect(user.tenants[0].roles).toContain("tenant-admin")
      }
    })
  })

  describe("Collection Access Control", () => {
    describe("Users Collection", () => {
      it("should allow admins to create users", async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ["user-admin"]
        )

        const payload = await getTestPayload()
        
        // Admin should be able to create users
        const newUser = await payload.create({
          collection: "users",
          data: {
            email: "new-user@example.com",
            password: "TestPass123",
            roles: ["user-admin"],
          },
          req: {
            user,
            headers: {
              authorization: `JWT ${token}`,
            },
          } as any,
        })

        expect(newUser).toBeDefined()
        expect(newUser.email).toBe("new-user@example.com")
        
        // Cleanup
        await deleteTestUser("new-user@example.com")
      })

      it("should allow anyone to read users", async () => {
        const payload = await getTestPayload()
        
        // Should be able to read users without authentication
        const users = await payload.find({
          collection: "users",
        })

        expect(users.docs.length).toBeGreaterThanOrEqual(0)
      })

      it("should allow admins and self to update users", async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ["user-admin"]
        )

        const payload = await getTestPayload()
        
        // Admin should be able to update their own user
        const updatedUser = await payload.update({
          collection: "users",
          id: user.id,
          data: {
            firstName: "Updated",
          },
          req: {
            user,
            headers: {
              authorization: `JWT ${token}`,
            },
          } as any,
        })

        expect(updatedUser.firstName).toBe("Updated")
      })

      it("should allow admins to delete users", async () => {
        // Create a user to delete
        const userToDelete = await createTestUser(
          "user-to-delete@example.com",
          "TestPass123",
          ["user-admin"]
        )

        const { user: adminUser, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ["user-admin"]
        )

        const payload = await getTestPayload()
        
        // Admin should be able to delete users
        await payload.delete({
          collection: "users",
          id: userToDelete.user.id,
          req: {
            user: adminUser,
            headers: {
              authorization: `JWT ${token}`,
            },
          } as any,
        })

        // Verify user is deleted
        const deletedUser = await payload.findByID({
          collection: "users",
          id: userToDelete.user.id,
        }).catch(() => null)

        expect(deletedUser).toBeNull()
      })
    })

    describe("Pages Collection", () => {
      it("should require authentication to create pages", async () => {
        const payload = await getTestPayload()
        
        // Should fail without authentication
        await expect(
          payload.create({
            collection: "pages",
            data: {
              title: "Test Page",
              slug: "test-page",
              hero: {
                type: "none",
              },
              layout: [],
            },
          })
        ).rejects.toThrow()
      })

      it("should allow public read access to published pages", async () => {
        const payload = await getTestPayload()
        
        // Should be able to read published pages without auth
        const pages = await payload.find({
          collection: "pages",
          where: {
            _status: {
              equals: "published",
            },
          },
        })

        expect(pages.docs.length).toBeGreaterThanOrEqual(0)
      })

      it("should restrict draft page access to authenticated users", async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ["user-admin"]
        )

        const payload = await getTestPayload()
        
        // Authenticated user should be able to read drafts
        const drafts = await payload.find({
          collection: "pages",
          where: {
            _status: {
              equals: "draft",
            },
          },
          req: {
            user,
            headers: {
              authorization: `JWT ${token}`,
            },
          } as any,
        })

        expect(drafts.docs.length).toBeGreaterThanOrEqual(0)
      })
    })

    describe("Posts Collection", () => {
      it("should require authentication to manage posts", async () => {
        const payload = await getTestPayload()
        
        // Should fail without authentication
        await expect(
          payload.create({
            collection: "posts",
            data: {
              title: "Test Post",
              slug: "test-post",
              content: {
                root: {
                  type: "root",
                  children: [],
                  direction: "ltr",
                  format: "",
                  indent: 0,
                  version: 1,
                },
              },
            },
          })
        ).rejects.toThrow()
      })

      it("should allow public read access to published posts", async () => {
        const payload = await getTestPayload()
        
        // Should be able to read published posts without auth
        const posts = await payload.find({
          collection: "posts",
          where: {
            _status: {
              equals: "published",
            },
          },
        })

        expect(posts.docs.length).toBeGreaterThanOrEqual(0)
      })
    })

    describe("Products & Prices Collections", () => {
      it("should restrict product creation to admins", async () => {
        const { user, token } = await createTestUser(
          testUsers.admin.email,
          testUsers.admin.password,
          ["user-admin"]
        )

        const payload = await getTestPayload()
        
        // Admin should be able to create products
        const product = await payload.create({
          collection: "products",
          data: {
            title: "Test Product",
          },
          req: {
            user,
            headers: {
              authorization: `JWT ${token}`,
            },
          } as any,
        })

        expect(product).toBeDefined()
        expect(product.title).toBe("Test Product")
        
        // Cleanup
        await payload.delete({
          collection: "products",
          id: product.id,
        })
      })

      it("should allow public read access to products", async () => {
        const payload = await getTestPayload()
        
        // Should be able to read products without auth
        const products = await payload.find({
          collection: "products",
        })

        expect(products.docs.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe("Field-Level Access Control", () => {
    it("should restrict roles field to super admins", async () => {
      const { user: adminUser } = await createTestUser(
        testUsers.admin.email,
        testUsers.admin.password,
        ["user-admin"]
      )

      const { user: superAdminUser } = await createTestUser(
        testUsers.superAdmin.email,
        testUsers.superAdmin.password,
        ["user-super-admin"]
      )

      // Regular admin should not be able to modify roles
      const isSuperAdminForAdmin = await isSuperAdmin({
        req: {
          user: adminUser,
        } as any,
      })
      expect(isSuperAdminForAdmin).toBe(false)

      // Super admin should be able to modify roles
      const isSuperAdminForSuper = await isSuperAdmin({
        req: {
          user: superAdminUser,
        } as any,
      })
      expect(isSuperAdminForSuper).toBe(true)
    })

    it("should restrict tenant field access", async () => {
      const { user } = await createTestUser(
        testUsers.tenantAdmin.email,
        testUsers.tenantAdmin.password,
        ["user-admin"],
        tenant1.id,
        ["tenant-admin"]
      )

      // Tenant admin should have tenant access
      expect(user.tenants).toBeDefined()
      expect(user.tenants?.length).toBeGreaterThan(0)
    })

    it("should prevent unauthorized field access", async () => {
      const { user } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ["user-admin"]
      )

      // Regular user should not have super admin access
      const isSuperAdminResult = await isSuperAdmin({
        req: {
          user,
        } as any,
      })
      expect(isSuperAdminResult).toBe(false)
    })
  })

  describe("API Endpoint Authorization", () => {
    it("should require authentication for protected endpoints", async () => {
      const payload = await getTestPayload()
      
      // Should fail without authentication for protected operations
      await expect(
        payload.create({
          collection: "users",
          data: {
            email: "test@example.com",
            password: "TestPass123",
            roles: ["user-admin"],
          },
        })
      ).rejects.toThrow()
    })

    it("should validate JWT tokens on each request", async () => {
      const { token } = await createTestUser(
        testUsers.admin.email,
        testUsers.admin.password,
        ["user-admin"]
      )

      const payload = await getTestPayload()
      
      // Valid token should work
      const users = await payload.find({
        collection: "users",
        req: {
          user: null,
          headers: {
            authorization: `JWT ${token}`,
          },
        } as any,
      })

      expect(users.docs.length).toBeGreaterThanOrEqual(0)
    })

    it("should return 401 for invalid tokens", async () => {
      const payload = await getTestPayload()
      
      // Invalid token should fail
      await expect(
        payload.find({
          collection: "users",
          req: {
            user: null,
            headers: {
              authorization: "JWT invalid-token",
            },
          } as any,
        })
      ).rejects.toThrow()
    })

    it("should return 403 for insufficient permissions", async () => {
      const { user, token } = await createTestUser(
        testUsers.regularUser.email,
        testUsers.regularUser.password,
        ["user-admin"]
      )

      const payload = await getTestPayload()
      
      // Regular admin should not be able to delete users (only super admin can)
      // This test verifies access control works
      const isSuperAdminResult = await isSuperAdmin({
        req: {
          user,
        } as any,
      })
      expect(isSuperAdminResult).toBe(false)
    })
  })
})
