#!/usr/bin/env tsx

/**
 * Provision a test / local-dev Postgres database (idempotent, connection-string first).
 *
 * Resolution order for the target database:
 *   1. An explicit connection string: `--url=…` > TEST_DATABASE_URL > POSTGRES_URL > DATABASE_URL.
 *      Used as-is, no Docker required. This is the path the CI Postgres service
 *      container, the Nix-managed local Postgres, and a Neon branch all take.
 *   2. Otherwise, bring up the bundled docker-compose Postgres
 *      (infrastructure/docker-compose/services/test.yml — pgvector/pgvector:pg16,
 *      port 5433) and target that. Requires Docker.
 *
 * Steps (all idempotent): resolve URL → wait for ready → apply schema → [seed].
 *
 * Schema is applied with `drizzle-kit migrate` (committed migration files, for
 * production fidelity). Migration 0000 runs `CREATE EXTENSION vector`, so the
 * target image must ship pgvector (pgvector/pgvector:pg16, or the Nix dev shell's
 * `postgresql_16.withPackages pgvector`). Pass `--push` for a faster
 * `drizzle-kit push` (schema-diff, dev only) which ensures the extension first.
 *
 * Usage:
 *   pnpm db:setup-test                      # use $POSTGRES_URL, else spin up Docker
 *   pnpm db:setup-test --push               # fast schema push instead of migrate
 *   pnpm db:setup-test --seed               # also run `pnpm db:seed`
 *   pnpm db:setup-test --url=postgres://…   # target an explicit database
 *   POSTGRES_URL=… pnpm db:setup-test
 *
 * Exported (`ensureTestDatabase`) for reuse by scripts/dev-tools/admin-local.ts.
 *
 * @dependencies
 * - @revealui/scripts/errors - ErrorCode enum for exit codes
 * - @revealui/scripts - commandExists, createLogger, execCommand, getProjectRoot, waitFor
 * - node:url - pathToFileURL for the direct-run guard
 *
 * @requires
 * - Environment: POSTGRES_URL / DATABASE_URL / TEST_DATABASE_URL (optional — Docker fallback otherwise)
 * - External (fallback only): docker + docker compose
 */

import { pathToFileURL } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';
import {
  commandExists,
  createLogger,
  execCommand,
  getProjectRoot,
  waitFor,
} from '@revealui/scripts/index.js';

const logger = createLogger();

const COMPOSE_FILE = 'infrastructure/docker-compose/services/test.yml';
const DOCKER_TEST_URL = 'postgresql://test:test@localhost:5433/test_revealui';
const URL_FLAG = '--url=';

export interface EnsureTestDatabaseOptions {
  /** Explicit connection string. Falls back to TEST_DATABASE_URL/POSTGRES_URL/DATABASE_URL, then Docker. */
  url?: string;
  /** Use `drizzle-kit push` (fast schema diff) instead of `drizzle-kit migrate` (committed files). */
  push?: boolean;
  /** Run `pnpm db:seed` after the schema is applied. */
  seed?: boolean;
}

export interface EnsureTestDatabaseResult {
  /** The resolved connection string the database is reachable at. */
  url: string;
  /** True when this run started the bundled docker-compose Postgres. */
  usedDocker: boolean;
  /** True when the schema was applied successfully. */
  migrated: boolean;
  /** True when seed data was applied successfully. */
  seeded: boolean;
}

/**
 * Redact the password from a Postgres URL for safe logging. Uses the URL parser
 * rather than a regex, per the no-regex (M2) posture.
 */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.password) url.password = '****';
    return url.toString();
  } catch {
    return '[unparseable database url]';
  }
}

/** First non-empty connection string from the explicit value, then the env fallbacks. */
function resolveExplicitUrl(explicit?: string): string | undefined {
  const candidates = [
    explicit,
    process.env.TEST_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
}

/** Resolve the docker-compose invocation, or exit if Docker is unavailable. */
async function resolveComposeCommand(): Promise<string> {
  if (!(await commandExists('docker'))) {
    logger.error(
      'No database URL set and Docker is not installed. Set POSTGRES_URL (Nix dev shell, ' +
        'CI service container, or a Neon branch), or install Docker for the bundled test database.',
    );
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  const hasComposePlugin = (await execCommand('docker', ['compose', 'version'], { capture: true }))
    .success;
  if (hasComposePlugin) return 'docker compose';

  if (await commandExists('docker-compose')) return 'docker-compose';

  logger.error('docker-compose is not available. Install the Docker Compose plugin.');
  process.exit(ErrorCode.EXECUTION_ERROR);
}

/** Start the bundled docker-compose Postgres and wait until it accepts connections. */
async function startDockerDatabase(projectRoot: string, composeCmd: string): Promise<void> {
  logger.info('Starting bundled test database (docker compose)…');
  const [cmd, ...prefix] = composeCmd.split(' ');

  const startResult = await execCommand(cmd, [...prefix, '-f', COMPOSE_FILE, 'up', '-d'], {
    cwd: projectRoot,
  });
  if (!startResult.success) {
    logger.error('Failed to start the docker-compose test database');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  const ready = await waitFor(
    async () => {
      const probe = await execCommand(
        cmd,
        [...prefix, '-f', COMPOSE_FILE, 'exec', '-T', 'postgres-test', 'pg_isready', '-U', 'test'],
        { cwd: projectRoot, capture: true },
      );
      return probe.success;
    },
    60000,
    1000,
  );

  if (!ready) {
    logger.error('Test database did not become ready in time');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
  logger.success('Test database is ready');
}

/**
 * Ensure the pgvector extension exists on an explicit URL via psql. Only needed
 * for the `--push` path; the migrate path creates it through migration 0000.
 * Best-effort: warns (does not fail) when psql is unavailable.
 */
async function ensureVectorExtension(url: string): Promise<void> {
  if (!(await commandExists('psql'))) {
    logger.warning(
      'psql not found — skipping explicit pgvector ensure (db:push may fail if the extension is missing)',
    );
    return;
  }
  const result = await execCommand(
    'psql',
    [url, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE EXTENSION IF NOT EXISTS vector;'],
    { capture: true },
  );
  if (result.success) logger.success('pgvector extension ensured');
  else logger.warning('Could not ensure pgvector extension (db:push may fail)');
}

/** Apply the schema to the target database. Returns true on success. */
async function applySchema(projectRoot: string, url: string, push: boolean): Promise<boolean> {
  const env = { POSTGRES_URL: url, DATABASE_URL: url };

  if (push) {
    // drizzle-kit push reads the built schema (dist) — build first.
    logger.info('Building @revealui/db (required for drizzle-kit push)…');
    await execCommand('pnpm', ['--filter', '@revealui/db', 'build'], { cwd: projectRoot, env });
    await ensureVectorExtension(url);
    logger.info('Applying schema via drizzle-kit push…');
    const result = await execCommand('pnpm', ['--filter', '@revealui/db', 'db:push'], {
      cwd: projectRoot,
      env,
    });
    if (result.success) logger.success('Schema pushed');
    else logger.error('drizzle-kit push failed');
    return result.success;
  }

  // Default: apply committed migration files (production fidelity).
  // Migration 0000 runs `CREATE EXTENSION vector`, so the target image must ship pgvector.
  logger.info('Applying migrations via drizzle-kit migrate…');
  const result = await execCommand('pnpm', ['--filter', '@revealui/db', 'db:migrate'], {
    cwd: projectRoot,
    env,
  });
  if (result.success) logger.success('Migrations applied');
  else logger.error('drizzle-kit migrate failed');
  return result.success;
}

/** Run the seed scripts against the target database. Returns true on success. */
async function applySeed(projectRoot: string, url: string): Promise<boolean> {
  logger.info('Seeding database (pnpm db:seed)…');
  const result = await execCommand('pnpm', ['db:seed'], {
    cwd: projectRoot,
    env: { POSTGRES_URL: url, DATABASE_URL: url },
  });
  if (result.success) logger.success('Seed complete');
  else logger.warning('Seed failed (continuing — seed is best-effort)');
  return result.success;
}

/**
 * Provision a ready-to-use test/dev database: resolve a connection string
 * (explicit/env, else docker-compose), apply the schema, and optionally seed.
 */
export async function ensureTestDatabase(
  options: EnsureTestDatabaseOptions = {},
): Promise<EnsureTestDatabaseResult> {
  const projectRoot = await getProjectRoot(import.meta.url);

  let url = resolveExplicitUrl(options.url);
  let usedDocker = false;

  if (url) {
    logger.info(`Using existing database: ${redactUrl(url)}`);
  } else {
    const composeCmd = await resolveComposeCommand();
    await startDockerDatabase(projectRoot, composeCmd);
    url = DOCKER_TEST_URL;
    usedDocker = true;
    logger.info(`Using bundled test database: ${redactUrl(url)}`);
    logger.info(`  Stop it with: ${composeCmd} -f ${COMPOSE_FILE} down`);
  }

  const migrated = await applySchema(projectRoot, url, options.push ?? false);
  const seeded = options.seed ? await applySeed(projectRoot, url) : false;

  return { url, usedDocker, migrated, seeded };
}

interface CliFlags {
  push: boolean;
  seed: boolean;
  url?: string;
}

function parseCliFlags(argv: string[]): CliFlags {
  const urlArg = argv.find((arg) => arg.startsWith(URL_FLAG));
  return {
    push: argv.includes('--push'),
    seed: argv.includes('--seed'),
    url: urlArg ? urlArg.slice(URL_FLAG.length) : undefined,
  };
}

async function main(): Promise<void> {
  logger.header('Setting up test database');
  const flags = parseCliFlags(process.argv.slice(2));

  try {
    const result = await ensureTestDatabase(flags);
    if (!result.migrated) {
      logger.error('Schema was not applied successfully — see errors above');
      process.exit(ErrorCode.EXECUTION_ERROR);
    }
    logger.header('Test database ready');
    logger.info(`Connection: ${redactUrl(result.url)}`);
    process.exit(ErrorCode.SUCCESS);
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}
