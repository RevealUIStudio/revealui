/**
 * @revealui/test  -  Test utilities, fixtures, and mocks
 *
 * Public API surface for the test package. Consumers can also use
 * subpath imports for integration helpers:
 *   - `@revealui/test/integration/setup`
 *   - `@revealui/test/integration/test-database`
 *   - `@revealui/test/utils` (PGlite drizzle harness: createTestDb)
 */

// Fixtures  -  test data factories (users, payments)
export * from './fixtures/index.js';

// Utilities  -  shared test helpers and mock utilities
export * from './utils/index.js';
