/** Canonical Drizzle migration roots recognized by the raw-SQL policy. */
export const SQL_MIGRATIONS_DIRS = [
  'packages/db/migrations',
  'apps/review-controller/migrations',
] as const;

export function isSqlMigrationFile(relPath: string): boolean {
  const normalized = relPath.split('\\').join('/');
  return SQL_MIGRATIONS_DIRS.some((dir) => normalized.startsWith(`${dir}/`));
}
