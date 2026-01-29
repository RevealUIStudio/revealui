export function dbSqlite() {
  throw new Error(
    'SQLite support has been removed from this workspace. Use Postgres/pglite adapters (configure DATABASE_URL accordingly) or install and enable `better-sqlite3` if you still need SQLite.',
  )
}
