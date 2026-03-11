/**
 * Integration test setup and teardown
 *
 * Provides global setup/teardown hooks for integration tests
 */

import { afterAll, afterEach, beforeAll } from 'vitest';
import {
  cleanupTestAPI,
  cleanupTestData,
  createTestAPI,
  resetTestState,
  setupTestDatabase,
  teardownTestDatabase,
} from '../utils/integration-helpers.js';

/**
 * Setup before all integration tests
 */
beforeAll(async () => {
  try {
    await setupTestDatabase();
    const revealui = await createTestAPI();

    // Verify setup actually worked - don't fail silently
    // This ensures tests can actually run
    try {
      await revealui.find({ collection: 'users', limit: 1 });
    } catch (error) {
      throw new Error(
        `Integration test setup verification failed: ${error instanceof Error ? error.message : String(error)}. ` +
          'The RevealUI instance was created but cannot query the users collection. ' +
          'Check collection configuration and database setup.',
      );
    }
  } catch (error) {
    // Fail loudly - don't let tests skip silently
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Integration test setup failed:', errorMessage);
    throw new Error(`Integration test setup failed: ${errorMessage}`);
  }
});

/**
 * Cleanup after all integration tests
 */
afterAll(async () => {
  await resetTestState();
});

/**
 * Cleanup test data after each test
 * We don't cleanup in beforeEach because that would delete data created in beforeAll
 * Only cleanup after tests complete to ensure data persists during the test suite
 */
afterEach(async () => {
  // Only cleanup data that was created during the test itself
  // Don't cleanup data created in beforeAll - that should persist for all tests in the suite
  // Track which suite we're in and only cleanup test-specific data
  await cleanupTestData();
});

export {
  setupTestDatabase,
  teardownTestDatabase,
  createTestAPI,
  cleanupTestAPI,
  cleanupTestData,
  resetTestState,
};
