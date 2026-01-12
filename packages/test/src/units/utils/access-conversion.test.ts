/**
 * Unit tests for access conversion utilities
 *
 * Tests actual utilities from packages/revealui/src/core/utils/access-conversion.ts
 */

import { describe, expect, it } from 'vitest'
import type { RevealUIAccessContext } from '../../../../../packages/revealui/src/core/types/access.js'
import type { RevealUIPermission } from '../../../../../packages/revealui/src/core/types/user.js'
// @ts-expect-error - Direct import for testing
import {
  combineRevealUIAccessRules,
  convertToRevealUIAccessRule,
  createEnhancedAccessRule,
  createRevealUIAccessRule,
  evaluateRevealUIAccessRule,
} from '../../../../../packages/revealui/src/core/utils/access-conversion.js'

describe('Access Conversion Utilities', () => {
  describe('createRevealUIAccessRule', () => {
    it('should create a basic access rule', () => {
      const rule = createRevealUIAccessRule({})
      expect(rule).toBeDefined()
      expect(rule.tenant).toBeUndefined()
      expect(rule.user).toBeUndefined()
      expect(rule.permissions).toBeUndefined()
    })

    it('should create rule with tenant constraint', () => {
      const rule = createRevealUIAccessRule({ tenant: 'tenant-123' })
      expect(rule.tenant).toBe('tenant-123')
    })

    it('should create rule with user constraint', () => {
      const rule = createRevealUIAccessRule({ user: 'user-123' })
      expect(rule.user).toBe('user-123')
    })

    it('should create rule with permissions', () => {
      const permissions: RevealUIPermission[] = ['read', 'write']
      const rule = createRevealUIAccessRule({ permissions })
      expect(rule.permissions).toEqual(permissions)
    })

    it('should create rule with custom condition', () => {
      const condition = (context: RevealUIAccessContext) => {
        return context.user?.id === 'user-123'
      }
      const rule = createRevealUIAccessRule({ condition })
      expect(rule.condition).toBe(condition)
    })
  })

  describe('convertToRevealUIAccessRule', () => {
    it('should convert permissions array to access rule', () => {
      const permissions: RevealUIPermission[] = ['read', 'write']
      const rule = convertToRevealUIAccessRule(permissions)

      expect(rule.permissions).toEqual(permissions)
      expect(rule.condition).toBeDefined()
      expect(typeof rule.condition).toBe('function')
    })

    it('should allow super admin with all permissions', () => {
      const permissions: RevealUIPermission[] = ['read']
      const rule = convertToRevealUIAccessRule(permissions)

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'admin@example.com',
          revealUI: { isSuperAdmin: true },
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })

    it('should check user has required permissions', () => {
      const permissions: RevealUIPermission[] = ['read', 'write']
      const rule = convertToRevealUIAccessRule(permissions)

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read', 'write'],
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })

    it('should deny access if user lacks permissions', () => {
      const permissions: RevealUIPermission[] = ['read', 'write']
      const rule = convertToRevealUIAccessRule(permissions)

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(false)
    })

    it('should deny access if no user provided', () => {
      const permissions: RevealUIPermission[] = ['read']
      const rule = convertToRevealUIAccessRule(permissions)

      const context: RevealUIAccessContext = {
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(false)
    })

    it('should allow admin role to bypass permission checks', () => {
      const permissions: RevealUIPermission[] = ['write']
      const rule = convertToRevealUIAccessRule(permissions)

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'admin@example.com',
          roles: ['admin'],
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })
  })

  describe('createEnhancedAccessRule', () => {
    it('should create enhanced rule with permissions', () => {
      const permissions: RevealUIPermission[] = ['read']
      const rule = createEnhancedAccessRule({ permissions })

      expect(rule.permissions).toEqual(permissions)
      expect(rule.condition).toBeDefined()
    })

    it('should allow super admin by default', () => {
      const permissions: RevealUIPermission[] = ['write']
      const rule = createEnhancedAccessRule({ permissions })

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'admin@example.com',
          revealUI: { isSuperAdmin: true },
        },
        operation: 'write',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })

    it('should respect tenant scoping when enabled', () => {
      const permissions: RevealUIPermission[] = ['read']
      const rule = createEnhancedAccessRule({
        permissions,
        tenantScoped: true,
      })

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
          tenants: ['tenant-1'],
        },
        tenant: {
          id: 'tenant-1',
          name: 'Tenant 1',
          domain: 'tenant1.example.com',
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })

    it('should deny access if tenant scoped and user not in tenant', () => {
      const permissions: RevealUIPermission[] = ['read']
      const rule = createEnhancedAccessRule({
        permissions,
        tenantScoped: true,
      })

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
          tenants: ['tenant-1'],
        },
        tenant: {
          id: 'tenant-2',
          name: 'Tenant 2',
          domain: 'tenant2.example.com',
        },
        operation: 'read',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(false)
    })

    it('should execute custom condition', () => {
      const customCondition = (context: RevealUIAccessContext) => {
        return context.data?.allowed === true
      }

      const rule = createEnhancedAccessRule({
        permissions: ['read'],
        customCondition,
      })

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
        },
        operation: 'read',
        data: { allowed: true },
      }

      const result = rule.condition?.(context)
      expect(result).toBe(true)
    })

    it('should respect allowSuperAdmin: false', () => {
      const rule = createEnhancedAccessRule({
        permissions: ['write'],
        allowSuperAdmin: false,
      })

      const context: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'admin@example.com',
          revealUI: { isSuperAdmin: true },
        },
        operation: 'write',
      }

      const result = rule.condition?.(context)
      expect(result).toBe(false)
    })
  })

  describe('evaluateRevealUIAccessRule', () => {
    it('should return true for rule without constraints', () => {
      const rule = createRevealUIAccessRule({})
      const context: RevealUIAccessContext = {
        operation: 'read',
      }

      const result = evaluateRevealUIAccessRule(rule, context)
      expect(result).toBe(true)
    })

    it('should check tenant constraint', () => {
      const rule = createRevealUIAccessRule({ tenant: 'tenant-123' })

      const context1: RevealUIAccessContext = {
        tenant: {
          id: 'tenant-123',
          name: 'Tenant',
          domain: 'example.com',
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        tenant: {
          id: 'tenant-456',
          name: 'Tenant 2',
          domain: 'example2.com',
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context2)).toBe(false)
    })

    it('should check user constraint', () => {
      const rule = createRevealUIAccessRule({ user: 'user-123' })

      const context1: RevealUIAccessContext = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        user: {
          id: 'user-456',
          email: 'user2@example.com',
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context2)).toBe(false)
    })

    it('should check permissions', () => {
      const rule = createRevealUIAccessRule({
        permissions: ['read', 'write'],
      })

      const context1: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read', 'write'],
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
        },
        operation: 'read',
      }
      expect(evaluateRevealUIAccessRule(rule, context2)).toBe(false)
    })

    it('should execute custom condition', () => {
      const rule = createRevealUIAccessRule({
        condition: (context) => context.data?.allowed === true,
      })

      const context1: RevealUIAccessContext = {
        operation: 'read',
        data: { allowed: true },
      }
      expect(evaluateRevealUIAccessRule(rule, context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        operation: 'read',
        data: { allowed: false },
      }
      expect(evaluateRevealUIAccessRule(rule, context2)).toBe(false)
    })
  })

  describe('combineRevealUIAccessRules', () => {
    it('should combine rules with OR logic', () => {
      const rule1 = createRevealUIAccessRule({ user: 'user-1' })
      const rule2 = createRevealUIAccessRule({ user: 'user-2' })

      const combined = combineRevealUIAccessRules([rule1, rule2], 'OR')

      const context1: RevealUIAccessContext = {
        user: { id: 'user-1', email: 'user1@example.com' },
        operation: 'read',
      }
      expect(combined.condition?.(context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        user: { id: 'user-2', email: 'user2@example.com' },
        operation: 'read',
      }
      expect(combined.condition?.(context2)).toBe(true)

      const context3: RevealUIAccessContext = {
        user: { id: 'user-3', email: 'user3@example.com' },
        operation: 'read',
      }
      expect(combined.condition?.(context3)).toBe(false)
    })

    it('should combine rules with AND logic', () => {
      const rule1 = createRevealUIAccessRule({
        permissions: ['read'],
      })
      const rule2 = createRevealUIAccessRule({
        tenant: 'tenant-1',
      })

      const combined = combineRevealUIAccessRules([rule1, rule2], 'AND')

      const context1: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
        },
        tenant: {
          id: 'tenant-1',
          name: 'Tenant 1',
          domain: 'tenant1.example.com',
        },
        operation: 'read',
      }
      expect(combined.condition?.(context1)).toBe(true)

      const context2: RevealUIAccessContext = {
        user: {
          id: '1',
          email: 'user@example.com',
          roles: ['read'],
        },
        tenant: {
          id: 'tenant-2',
          name: 'Tenant 2',
          domain: 'tenant2.example.com',
        },
        operation: 'read',
      }
      expect(combined.condition?.(context2)).toBe(false)
    })

    it('should default to OR logic', () => {
      const rule1 = createRevealUIAccessRule({ user: 'user-1' })
      const rule2 = createRevealUIAccessRule({ user: 'user-2' })

      const combined = combineRevealUIAccessRules([rule1, rule2])

      const context: RevealUIAccessContext = {
        user: { id: 'user-1', email: 'user1@example.com' },
        operation: 'read',
      }
      expect(combined.condition?.(context)).toBe(true)
    })
  })
})
