/**
 * Test Fixtures
 *
 * Central export for all test fixtures
 */

export * from './users.js'
export * from './posts.js'

import { resetUserCounter } from './users.js'
import { resetPostCounter } from './posts.js'

/**
 * Reset all counters for test isolation
 */
export function resetAllCounters(): void {
  resetUserCounter()
  resetPostCounter()
}
