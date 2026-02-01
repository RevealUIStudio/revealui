// Stub for better-sqlite3 so tests that import built sqlite adapter don't fail
export default class BetterSqlite3Mock {
  constructor() {
    throw new Error(
      'better-sqlite3 is not installed in the test environment. Use universalPostgresAdapter or install better-sqlite3 to enable sqliteAdapter.',
    )
  }
}
