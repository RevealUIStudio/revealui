/**
 * Test Fixtures
 *
 * Central export for all test fixtures
 */

export * from './posts.js'
export * from './users.js'

import { resetPostCounter } from './posts.js'
import { resetUserCounter } from './users.js'

/**
 * Reset all counters for test isolation
 */
export function resetAllCounters(): void {
  resetUserCounter()
  resetPostCounter()
}
