/**
 * Test-only PGlite harness for `@revealui/db`.
 * Not a production surface — import from `@revealui/db/testing` in tests only.
 */
export {
  type CreateTestDbOptions,
  cleanTables,
  createTestDb,
  seedTestUser,
  type TestDb,
} from './drizzle-test-db.js';
