/**
 * Single application database URL.
 *
 * Precedence (first non-empty value wins):
 * 1. POSTGRES_URL
 * 2. DATABASE_URL
 * 3. NEON_DATABASE_URL
 * 4. SUPABASE_DATABASE_URI
 *
 * POSTGRES_URL is the canonical name. `@revealui/config` (`getDatabaseConfig`),
 * the Drizzle client, and auth server storage already preferred it on the main
 * request path. DATABASE_URL is the documented fallback used when POSTGRES_URL
 * is empty. NEON_DATABASE_URL and SUPABASE_DATABASE_URI are legacy names and
 * apply only when both canonical names are empty, so a set POSTGRES_URL or
 * DATABASE_URL keeps current production routing.
 *
 * When POSTGRES_URL and DATABASE_URL are both non-empty and not equal:
 * - NODE_ENV=production throws DatabaseUrlConflictError and returns nothing
 * - every other NODE_ENV warns once and returns POSTGRES_URL
 *
 * The warning and the error name variable names only. They never include URL
 * values or credentials. TEST_DATABASE_URL is intentionally not in this list:
 * it is a test-harness alias, not an application database.
 */

export const DATABASE_URL_PRECEDENCE = [
  'POSTGRES_URL',
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'SUPABASE_DATABASE_URI',
] as const;

export type DatabaseUrlVariable = (typeof DATABASE_URL_PRECEDENCE)[number];

export interface DatabaseUrlEnv {
  POSTGRES_URL?: string | undefined;
  DATABASE_URL?: string | undefined;
  NEON_DATABASE_URL?: string | undefined;
  SUPABASE_DATABASE_URI?: string | undefined;
  NODE_ENV?: string | undefined;
}

export interface ResolveDatabaseUrlOptions {
  /** Overrides env.NODE_ENV and process.env.NODE_ENV when provided. */
  nodeEnv?: string;
  /**
   * Non-production conflict sink. The message names variables only.
   * Invoked at most once per process until resetDatabaseUrlConflictWarning().
   */
  warn?: (message: string, variableNames: readonly string[]) => void;
}

const CONFLICT_VARIABLES = ['POSTGRES_URL', 'DATABASE_URL'] as const;

const CONFLICT_WARNING =
  'Database URL conflict: POSTGRES_URL and DATABASE_URL are both set and differ. Using POSTGRES_URL. Variables set: POSTGRES_URL, DATABASE_URL.';

const CONFLICT_ERROR =
  'Database URL conflict: POSTGRES_URL and DATABASE_URL are both set and differ. Refusing to choose a database. Variables set: POSTGRES_URL, DATABASE_URL.';

export class DatabaseUrlConflictError extends Error {
  readonly variableNames: readonly ['POSTGRES_URL', 'DATABASE_URL'];

  constructor() {
    super(CONFLICT_ERROR);
    this.name = 'DatabaseUrlConflictError';
    this.variableNames = CONFLICT_VARIABLES;
  }
}

let conflictWarned = false;

/** Test hook. Production warns at most once per process until this runs. */
export function resetDatabaseUrlConflictWarning(): void {
  conflictWarned = false;
}

function readSetValue(env: DatabaseUrlEnv, key: DatabaseUrlVariable): string | undefined {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

function readNodeEnv(env: DatabaseUrlEnv, options: ResolveDatabaseUrlOptions): string | undefined {
  if (typeof options.nodeEnv === 'string') return options.nodeEnv;
  if (typeof env.NODE_ENV === 'string' && env.NODE_ENV.length > 0) return env.NODE_ENV;
  const fromProcess = process.env.NODE_ENV;
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  return undefined;
}

function warnConflict(options: ResolveDatabaseUrlOptions): void {
  if (conflictWarned) return;
  conflictWarned = true;
  if (options.warn) {
    options.warn(CONFLICT_WARNING, CONFLICT_VARIABLES);
    return;
  }
  process.emitWarning(CONFLICT_WARNING, {
    type: 'DatabaseUrlConflict',
    code: 'REVEALUI_DATABASE_URL_CONFLICT',
  });
}

/**
 * Resolve the application database URL from `env` (default `process.env`).
 * Returns undefined when every name in DATABASE_URL_PRECEDENCE is empty.
 * Throws DatabaseUrlConflictError in production when POSTGRES_URL and
 * DATABASE_URL are both set and differ.
 */
export function resolveDatabaseUrl(
  env: DatabaseUrlEnv = process.env,
  options: ResolveDatabaseUrlOptions = {},
): string | undefined {
  const postgres = readSetValue(env, 'POSTGRES_URL');
  const database = readSetValue(env, 'DATABASE_URL');
  if (postgres !== undefined && database !== undefined && postgres !== database) {
    if (readNodeEnv(env, options) === 'production') {
      throw new DatabaseUrlConflictError();
    }
    warnConflict(options);
  }

  for (const key of DATABASE_URL_PRECEDENCE) {
    const value = readSetValue(env, key);
    if (value !== undefined) return value;
  }
  return undefined;
}
