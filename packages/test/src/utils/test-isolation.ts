/**
 * Test isolation utilities
 *
 * Provides utilities for creating isolated test contexts and tracking test data
 */

import { createTestId } from './test-helpers'

/**
 * Test context for tracking test data
 */
export interface TestContext {
  userIds: string[]
  tenantIds: string[]
  testId: string
  [key: string]: unknown
}

/**
 * Create isolated test context
 */
export function createTestContext(): TestContext {
  return {
    userIds: [],
    tenantIds: [],
    testId: createTestId('test'),
  }
}

/**
 * Generate unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  return createTestId(prefix)
}

/**
 * Track test data for cleanup
 */
export function trackTestData(context: TestContext, type: string, id: string): void {
  if (type === 'user') {
    context.userIds.push(id)
  } else if (type === 'tenant') {
    context.tenantIds.push(id)
  } else {
    if (!context[`${type}Ids`]) {
      context[`${type}Ids`] = []
    }
    ;(context[`${type}Ids`] as string[]).push(id)
  }
}
