/**
 * Shared environment bootstrap for fleet seed scripts.
 *
 * Caller-supplied database URLs take precedence over dotenv files, including
 * passwordless URLs. POSTGRES_URL wins when both caller keys are set; otherwise
 * DATABASE_URL is promoted before files are loaded. Authentication is decided
 * by the existing connector, never by substituting another database target.
 * Fleet seeds retain the existing probe-database guard and fail closed before
 * writes when the selected URL is invalid or cannot accept a connection.
 *
 * Owner resolution for site.ownerId is separate (see resolveSeedOwnerEmail).
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from 'dotenv';

const require = createRequire(import.meta.url);

const DEFAULT_ENV_FILES = [
  '.env',
  '.env.development.local',
  '.env.local',
  'apps/server/.env.vercel',
  'apps/admin/.env.local',
] as const;

/** Well-known electric-latency-probe compose identity (scripts/electric-latency-probe/). */
export const PROBE_DB_PORT = '5434';
export const PROBE_DB_NAME = 'revealui_probe';

export interface ParsedDbTarget {
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly user: string;
}

/**
 * Parse a Postgres URL for logging / probe detection. Never returns the password.
 * Accepts both `postgres://` and `postgresql://`.
 */
export function parseDbTarget(raw: string): ParsedDbTarget | null {
  try {
    const url = new URL(raw);
    if (!(['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname)) return null;
    // Match pg-connection-string's interpretation before classifying a target.
    // An encoded probe name must not evade the seed guard.
    const database = decodeURI(url.pathname.slice(1));
    if (!database) return null;
    // pg-connection-string lets host/port query values override the URI target.
    // Refuse that ambiguity before target display and probe classification.
    for (const key of url.searchParams.keys()) {
      if (['host', 'port'].includes(key)) return null;
    }
    return {
      host: decodeURIComponent(url.hostname),
      port: url.port || '5432',
      database,
      user: decodeURIComponent(url.username || ''),
    };
  } catch {
    return null;
  }
}

/** Redact password from a connection string for logs. */
export function redactDatabaseUrl(raw: string): string {
  try {
    const normalized = raw.startsWith('postgres:') ? raw.replace(/^postgres(ql)?:/i, 'http:') : raw;
    const url = new URL(normalized);
    if (url.password) url.password = '****';
    return url
      .toString()
      .replace(/^http:/, raw.startsWith('postgresql:') ? 'postgresql:' : 'postgres:');
  } catch {
    return '[unparseable database url]';
  }
}

/**
 * True when the URL targets the electric-latency-probe stack.
 * Probe identity is port 5434 and/or database name `revealui_probe`.
 */
export function isProbeDatabaseUrl(raw: string): boolean {
  const target = parseDbTarget(raw);
  if (!target) return false;
  if (target.port === PROBE_DB_PORT) return true;
  if (target.database === PROBE_DB_NAME) return true;
  return false;
}

/**
 * Load seed configuration without replacing an explicit database target.
 * Promote the caller's DATABASE_URL before dotenv can supply POSTGRES_URL.
 */
export function loadSeedEnv(
  rootDir: string,
  envFiles: readonly string[] = DEFAULT_ENV_FILES,
): void {
  // An empty key is absence, not an instruction to suppress file configuration.
  if (process.env.POSTGRES_URL === '') delete process.env.POSTGRES_URL;
  if (process.env.DATABASE_URL === '') delete process.env.DATABASE_URL;
  if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
    process.env.POSTGRES_URL = process.env.DATABASE_URL;
  }

  for (const envFile of envFiles) {
    config({ path: resolve(rootDir, envFile), override: false });
  }

  if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
    process.env.POSTGRES_URL = process.env.DATABASE_URL;
  }
}

/** Resolved connection string after loadSeedEnv (POSTGRES_URL preferred). */
export function resolveSeedDatabaseUrl(): string | undefined {
  const candidates = [process.env.POSTGRES_URL, process.env.DATABASE_URL];
  return candidates.find((v): v is string => typeof v === 'string' && v.length > 0);
}

export class SeedEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedEnvError';
  }
}

/**
 * Fail closed when the configured URL is missing, is the probe DB, or cannot
 * accept a connection. Call after loadSeedEnv(), before getClient().
 *
 * Escape hatch (tests / intentional probe work only):
 *   REVEALUI_ALLOW_PROBE_DB=1
 *
 * Passwordless authentication is accepted only when the connector succeeds.
 */
export async function assertSeedDatabaseReady(options?: {
  allowProbe?: boolean;
  connect?: (url: string) => Promise<void>;
}): Promise<{ url: string; target: ParsedDbTarget }> {
  const url = resolveSeedDatabaseUrl();
  if (!url) {
    throw new SeedEnvError(
      'No database URL for seed. Set POSTGRES_URL (preferred) or DATABASE_URL to the ' +
        'local docker-compose Postgres (default host port 5432) or your Neon branch. ' +
        'Example local: POSTGRES_URL=postgresql://…@127.0.0.1:5432/revealui',
    );
  }

  const allowProbe = options?.allowProbe === true || process.env.REVEALUI_ALLOW_PROBE_DB === '1';
  if (isProbeDatabaseUrl(url) && !allowProbe) {
    const target = parseDbTarget(url);
    throw new SeedEnvError(
      [
        'Seed refused the electric-latency-probe database.',
        target
          ? `  target: ${target.host}:${target.port}/${target.database}`
          : `  url: ${redactDatabaseUrl(url)}`,
        'That stack is ephemeral (scripts/electric-latency-probe/, port 5434 / db revealui_probe)',
        'and must not receive fleet-marketing or admin seed writes.',
        '',
        'Configure the intended persistent database in the supported seed configuration.',
      ].join('\n'),
    );
  }

  const target = parseDbTarget(url);
  if (!target) {
    throw new SeedEnvError(
      'Expected a PostgreSQL URL with a host and database name, without host/port query aliases.',
    );
  }

  const connect =
    options?.connect ??
    (async (connectionString: string) => {
      const { default: pg } = await import('pg');
      const client = new pg.Client({
        connectionString,
        connectionTimeoutMillis: 4_000,
      });
      try {
        await client.connect();
        await client.query('select 1');
      } finally {
        await client.end().catch(() => {
          /* ignore close errors */
        });
      }
    });

  try {
    await connect(url);
  } catch {
    // Driver errors can include connection strings, passwords or SQL. Expose
    // only the validated target; the connection failure still stops all writes.
    throw new SeedEnvError(
      `Database connection failed at ${target.host}:${target.port}/${target.database}. Check connectivity and authentication for the selected database.`,
    );
  }

  return { url, target };
}

/**
 * Resolve which user email owns the fleet-marketing site row.
 *
 * Order (first that yields a non-empty string):
 *   1. REVEALUI_SEED_OWNER_EMAIL (explicit operator override)
 *   2. revealui/{env}/admin/bootstrap/email via revvault when available
 *   3. founder@revealui.com (historical seed default)
 *
 * The seed then looks up that email in `users`. If missing, it may fall back to
 * the first active owner/admin (see seed script).
 */
export function resolveSeedOwnerEmailCandidates(options?: {
  env?: string;
  revvaultEmail?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (value: string | undefined | null): void => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length > 0 && !out.includes(trimmed)) out.push(trimmed);
  };

  push(process.env.REVEALUI_SEED_OWNER_EMAIL);
  push(options?.revvaultEmail);
  push('founder@revealui.com');
  return out;
}

/**
 * Best-effort read of the bootstrap email from revvault (no throw).
 * Uses the same path layout as `pnpm admin:bootstrap`.
 */
export function tryReadBootstrapEmailFromRevvault(env = 'dev'): string | null {
  try {
    // Lazy require so seed scripts still run when @revealui/setup is not built.
    const { readRevvaultSecret } = require('@revealui/setup/revvault') as {
      readRevvaultSecret: (path: string) => string | null;
    };
    return readRevvaultSecret(`revealui/${env}/admin/bootstrap/email`);
  } catch {
    return null;
  }
}
