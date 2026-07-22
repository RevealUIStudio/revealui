/**
 * Shared environment bootstrap for fleet seed scripts.
 *
 * Durable rules (do not re-discover the hard way):
 * 1. Load local dotenv files without overriding an *authoritative* URL already
 *    in process.env (so `POSTGRES_URL=postgresql://user:pass@… pnpm db:seed:…`
 *    always wins).
 * 2. Demote passwordless shell defaults (Nix/direnv placeholder
 *    `postgresql://postgres@localhost:5432/postgres`) so apps/admin/.env.local
 *    and other seed env files can supply real credentials. Those placeholders
 *    produce SCRAM "client password must be a string" against docker-compose.
 * 3. Prefer POSTGRES_URL over DATABASE_URL (same as @revealui/db getClient).
 * 4. Refuse the electric-latency-probe database (port 5434 / db revealui_probe)
 *    for fleet seeds unless REVEALUI_ALLOW_PROBE_DB=1 — that DB is ephemeral and
 *    must never be the silent target of marketing seed / bootstrap.
 * 5. Fail loud with a redacted host:port/db when the URL is missing, passwordless
 *    without an escape hatch, or unreachable.
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

/**
 * Nix flake / .envrc local default when no password is configured.
 * Trust-auth nix `db-start` can use this; docker-compose SCRAM cannot.
 */
export const NIX_DIRENV_DEFAULT_DB_URL = 'postgresql://postgres@localhost:5432/postgres';

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
    const normalized = raw.startsWith('postgres:') ? raw.replace(/^postgres(ql)?:/i, 'http:') : raw;
    const url = new URL(normalized);
    const database = url.pathname.replace(/^\//, '').split('?')[0] ?? '';
    return {
      host: url.hostname || 'localhost',
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
 * True when the URL has a username but no password.
 * pg SCRAM then fails with: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string.
 */
export function isPasswordlessDatabaseUrl(raw: string): boolean {
  try {
    const normalized = raw.startsWith('postgres:') ? raw.replace(/^postgres(ql)?:/i, 'http:') : raw;
    const url = new URL(normalized);
    const user = url.username;
    if (!user) return false;
    // URL.password is "" when omitted (`postgres://user@host/db`) or empty (`user:@host`).
    return url.password.length === 0;
  } catch {
    return false;
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
 * A shell URL is authoritative only when it is non-empty and has credentials
 * suitable for password-auth servers (or is explicitly passwordless-allowed later).
 * Passwordless placeholders (direnv/flake) are demoted so dotenv files win.
 */
export function isAuthoritativeDatabaseUrl(raw: string | undefined): boolean {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  if (isPasswordlessDatabaseUrl(raw)) return false;
  return true;
}

/**
 * Clear passwordless POSTGRES_URL / DATABASE_URL so dotenv files can replace them.
 * Returns which keys were demoted (for tests / diagnostics).
 */
export function demotePasswordlessShellDatabaseUrls(): {
  demotedPostgres: boolean;
  demotedDatabase: boolean;
} {
  let demotedPostgres = false;
  let demotedDatabase = false;

  if (
    typeof process.env.POSTGRES_URL === 'string' &&
    process.env.POSTGRES_URL.length > 0 &&
    isPasswordlessDatabaseUrl(process.env.POSTGRES_URL)
  ) {
    delete process.env.POSTGRES_URL;
    demotedPostgres = true;
  }

  if (
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.length > 0 &&
    isPasswordlessDatabaseUrl(process.env.DATABASE_URL)
  ) {
    delete process.env.DATABASE_URL;
    demotedDatabase = true;
  }

  return { demotedPostgres, demotedDatabase };
}

/**
 * Load dotenv files into process.env (no override of authoritative already-set vars).
 * Passwordless shell defaults are demoted first so apps/admin/.env.local can win.
 * Then promote DATABASE_URL → POSTGRES_URL when only the former is set so
 * seed scripts and getClient share one resolution order.
 */
export function loadSeedEnv(
  rootDir: string,
  envFiles: readonly string[] = DEFAULT_ENV_FILES,
): void {
  demotePasswordlessShellDatabaseUrls();

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
 * Escape hatch for intentional passwordless / trust-auth local nix postgres:
 *   REVEALUI_ALLOW_PASSWORDLESS_DB=1
 */
export async function assertSeedDatabaseReady(options?: {
  allowProbe?: boolean;
  allowPasswordless?: boolean;
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
  const allowPasswordless =
    options?.allowPasswordless === true || process.env.REVEALUI_ALLOW_PASSWORDLESS_DB === '1';

  if (isPasswordlessDatabaseUrl(url) && !allowPasswordless) {
    const target = parseDbTarget(url);
    throw new SeedEnvError(
      [
        'Seed refused a passwordless database URL (SCRAM needs a string password).',
        target
          ? `  target: ${target.host}:${target.port}/${target.database} user=${target.user || '(none)'}`
          : `  url: ${redactDatabaseUrl(url)}`,
        '',
        'This is usually the Nix/direnv default:',
        `  ${NIX_DIRENV_DEFAULT_DB_URL}`,
        'which .envrc / flake.nix export when REVEALUI_USE_REMOTE_DB is not set.',
        'Docker-compose Postgres (revealui user, password auth) rejects that URL with:',
        '  SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string',
        '',
        'Fix (durable):',
        '  1. Put a real URL in apps/admin/.env.local (POSTGRES_URL or DATABASE_URL)',
        '     matching docker-compose, e.g. postgres://revealui:…@localhost:5432/revealui',
        '  2. Or pass an explicit override:',
        '     POSTGRES_URL=postgresql://user:pass@127.0.0.1:5432/revealui pnpm db:seed:fleet-marketing',
        '  3. Trust-auth nix `db-start` only: REVEALUI_ALLOW_PASSWORDLESS_DB=1',
      ].join('\n'),
    );
  }

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
        'Fix (durable):',
        '  1. Point apps/admin/.env.local DATABASE_URL / POSTGRES_URL at docker-compose Postgres',
        '     (default host port 5432, not 5434) or your real Neon URL from revvault.',
        '  2. Never leave the probe URL in .env.local after a latency probe — use a session',
        '     env override or apps/admin/.env.probe.local (see probe README).',
        '  3. Escape hatch only for intentional probe work: REVEALUI_ALLOW_PROBE_DB=1',
      ].join('\n'),
    );
  }

  const target = parseDbTarget(url);
  if (!target) {
    throw new SeedEnvError(
      `Database URL is unparseable: ${redactDatabaseUrl(url)}. Expected a postgres:// or postgresql:// URL.`,
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const passwordHint = /password must be a string|password authentication failed/i.test(detail)
      ? [
          '',
          'Password/auth hint:',
          '  - direnv may still be exporting the passwordless nix default; ensure',
          '    apps/admin/.env.local has a password-bearing URL (seed demotes passwordless shell vars)',
          '  - credentials must match the running container (docker: often revealui user, not postgres)',
        ]
      : [];
    throw new SeedEnvError(
      [
        `Database unreachable at ${target.host}:${target.port}/${target.database}.`,
        `  ${detail}`,
        '',
        'Check:',
        '  - docker compose postgres is up on the host port in your URL (default 5432)',
        '  - POSTGRES_URL is not a stale probe (5434 / revealui_probe)',
        '  - credentials match the running container',
        ...passwordHint,
      ].join('\n'),
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
