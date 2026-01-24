/**
 * Mock factories
 *
 * Provides type-safe mock generation with realistic mock data
 */

import { createTestId } from '../utils/test-helpers'

/**
 * Create mock user
 */
export function createMockUser(
  overrides?: Partial<{
    id: string
    email: string
    name: string
    roles: string[]
  }>,
): {
  id: string
  email: string
  name: string
  roles: string[]
  createdAt: Date
} {
  const testId = createTestId('user')

  return {
    id: overrides?.id || `user_${testId}`,
    email: overrides?.email || `user-${testId}@example.com`,
    name: overrides?.name || `Test User ${testId}`,
    roles: overrides?.roles || ['user'],
    createdAt: new Date(),
  }
}

/**
 * Create mock tenant
 */
export function createMockTenant(
  overrides?: Partial<{
    id: string
    name: string
    domain: string
  }>,
): {
  id: string
  name: string
  domain: string
  createdAt: Date
} {
  const testId = createTestId('tenant')

  return {
    id: overrides?.id || `tenant_${testId}`,
    name: overrides?.name || `Test Tenant ${testId}`,
    domain: overrides?.domain || `tenant-${testId}.example.com`,
    createdAt: new Date(),
  }
}

/**
 * Create mock payment
 */
export function createMockPayment(
  overrides?: Partial<{
    id: string
    amount: number
    currency: string
    status: string
  }>,
): {
  id: string
  amount: number
  currency: string
  status: string
  createdAt: Date
} {
  const testId = createTestId('payment')

  return {
    id: overrides?.id || `payment_${testId}`,
    amount: overrides?.amount || 1000,
    currency: overrides?.currency || 'usd',
    status: overrides?.status || 'pending',
    createdAt: new Date(),
  }
}

/**
 * Create mock collection document
 */
export function createMockDocument<T extends Record<string, unknown>>(
  collection: string,
  overrides?: Partial<T>,
): T & { id: string; createdAt: Date; updatedAt: Date } {
  const testId = createTestId(collection)

  return {
    id: `doc_${testId}`,
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as T & { id: string; createdAt: Date; updatedAt: Date }
}

/**
 * Create multiple mock items
 */
export function createMockItems<T>(factory: () => T, count: number): T[] {
  return Array.from({ length: count }, () => factory())
}
