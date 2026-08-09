/**
 * Re-export of the PGlite harness owned by `@revealui/db/testing`.
 *
 * Prefer `@revealui/db/testing` when the consumer already depends on `@revealui/db`.
 * This path remains for packages that already depend on `@revealui/test` (e.g. admin).
 */
export {
  type CreateTestDbOptions,
  cleanTables,
  createTestDb,
  seedTestUser,
  type TestDb,
} from '@revealui/db/testing';
