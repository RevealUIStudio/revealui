/**
 * Example: Testing Multi-Tenant
 *
 * This file demonstrates how to test tenant isolation, cross-tenant access prevention, and tenant-scoped queries
 *
 * Usage: Copy patterns from this file to your actual test files
 */

import type { RevealUIInstance } from '@revealui/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { getTestRevealUI, trackTestData } from '../utils/integration-helpers'

describe('Multi-Tenant Testing Patterns', () => {
  let revealui: RevealUIInstance
  const testPassword = 'TestPassword123!'

  beforeAll(async () => {
    revealui = await getTestRevealUI()
  })

  describe('Tenant Isolation', () => {
    it('should isolate data by tenant', async () => {
      const tenant1Email = `tenant1-${Date.now()}@example.com`
      const tenant2Email = `tenant2-${Date.now()}@example.com`

      // Create user for tenant 1
      const user1 = await revealui.create({
        collection: 'users',
        data: {
          email: tenant1Email,
          password: testPassword,
          roles: ['user-admin'],
          tenants: [{ tenant: 1, roles: ['user-admin'] }],
        },
      })

      trackTestData('users', String(user1.id))

      // Create user for tenant 2
      const user2 = await revealui.create({
        collection: 'users',
        data: {
          email: tenant2Email,
          password: testPassword,
          roles: ['user-admin'],
          tenants: [{ tenant: 2, roles: ['user-admin'] }],
        },
      })

      trackTestData('users', String(user2.id))

      // Verify users belong to different tenants
      expect((user1.tenants as any[])[0].tenant).toBe(1)
      expect((user2.tenants as any[])[0].tenant).toBe(2)
    })

    it('should prevent cross-tenant data access', async () => {
      // Create data for tenant 1
      const tenant1User = await revealui.create({
        collection: 'users',
        data: {
          email: `tenant1-access-${Date.now()}@example.com`,
          password: testPassword,
          roles: ['user-admin'],
          tenants: [{ tenant: 1, roles: ['user-admin'] }],
        },
      })

      trackTestData('users', String(tenant1User.id))

      // Attempt to access tenant 1 data from tenant 2 context
      // Should be denied or filtered
      const req = {
        user: {
          id: 'tenant2-user',
          tenants: [{ tenant: 2 }],
        },
        tenant: { id: 2 },
      } as any

      // Query should not return tenant 1 data
      const results = await revealui.find({
        collection: 'users',
        where: { id: { equals: tenant1User.id } },
        req,
      })

      // Should be empty or filtered
      expect(results.docs.length).toBe(0)
    })
  })

  describe('Tenant-Scoped Queries', () => {
    it('should filter queries by tenant', async () => {
      const tenantId = 1
      const tenantEmail = `tenant-scoped-${Date.now()}@example.com`

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: tenantEmail,
          password: testPassword,
          roles: ['user-admin'],
          tenants: [{ tenant: tenantId, roles: ['user-admin'] }],
        },
      })

      trackTestData('users', String(user.id))

      // Query with tenant context
      const req = {
        user: {
          id: 'test-user',
          tenants: [{ tenant: tenantId }],
        },
        tenant: { id: tenantId },
      } as any

      const results = await revealui.find({
        collection: 'users',
        where: { email: { equals: tenantEmail } },
        req,
      })

      // Should return only tenant-scoped results
      expect(results.docs.length).toBeGreaterThan(0)
      expect(results.docs[0].email).toBe(tenantEmail)
    })

    it('should handle tenant switching', async () => {
      // Test user switching between tenants
      // User should only see data for current tenant
    })
  })

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent accessing other tenant data', async () => {
      // Create data in tenant 1
      const tenant1Data = await revealui.create({
        collection: 'users',
        data: {
          email: `tenant1-data-${Date.now()}@example.com`,
          password: testPassword,
          roles: ['user-admin'],
          tenants: [{ tenant: 1, roles: ['user-admin'] }],
        },
      })

      trackTestData('users', String(tenant1Data.id))

      // Attempt to access from tenant 2
      const req = {
        user: {
          id: 'tenant2-user',
          tenants: [{ tenant: 2 }],
        },
        tenant: { id: 2 },
      } as any

      // Should not be able to access tenant 1 data
      await expect(
        revealui.findByID({
          collection: 'users',
          id: tenant1Data.id,
          req,
        }),
      ).rejects.toThrow()
    })
  })
})
