import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@revealui/setup/utils';
import { execa } from 'execa';
import { commandExists } from '../utils/command.js';
import { resolveLocalDbConfig, writeLocalDbConfigs } from '../utils/db.js';
import { findWorkspaceRoot } from '../utils/workspace.js';

const logger = createLogger({ prefix: 'DB' });

function isPgCtlNotRunningError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'exitCode' in error &&
    (error as { exitCode?: unknown }).exitCode === 3
  );
}

function getWorkspaceRootOrThrow(): string {
  const root = findWorkspaceRoot();
  if (!root) {
    throw new Error('RevealUI workspace root not found');
  }
  return root;
}

function buildDbEnv(root: string): NodeJS.ProcessEnv {
  const config = resolveLocalDbConfig(root, process.env);
  return {
    ...process.env,
    PGDATA: config.pgdata,
    PGHOST: config.pghost,
    PGDATABASE: config.pgdatabase,
    PGUSER: config.pguser,
    POSTGRES_URL: config.postgresUrl,
    DATABASE_URL: config.databaseUrl,
  };
}

function getPgDataOrThrow(env: NodeJS.ProcessEnv): string {
  const pgdata = env.PGDATA;
  if (!pgdata) {
    throw new Error('PGDATA is not configured for the local RevealUI database');
  }
  return pgdata;
}

async function requireCommand(command: string): Promise<void> {
  if (!(await commandExists(command))) {
    throw new Error(`${command} is not available in PATH`);
  }
}

export async function runDbInitCommand(options: { force?: boolean } = {}): Promise<void> {
  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);
  const pgdata = getPgDataOrThrow(env);

  await requireCommand('initdb');

  try {
    await fs.access(pgdata);
    if (!options.force) {
      throw new Error(`PostgreSQL is already initialized at ${pgdata}. Use --force to reset it.`);
    }
    await fs.rm(pgdata, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('already initialized')) {
      // PGDATA does not exist yet; continue.
    } else if (error instanceof Error) {
      throw error;
    }
  }

  await execa(
    'initdb',
    ['--locale=C.UTF-8', '--encoding=UTF8', '-D', pgdata, '--username=postgres'],
    {
      env,
      stdio: 'inherit',
    },
  );
  await writeLocalDbConfigs(pgdata);
  logger.success(`PostgreSQL initialized at ${pgdata}`);
}

export async function runDbStartCommand(): Promise<void> {
  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);
  const pgdata = getPgDataOrThrow(env);

  await requireCommand('pg_ctl');
  await fs.access(pgdata);

  await execa(
    'pg_ctl',
    ['start', '-D', pgdata, '-l', path.join(pgdata, 'logfile'), '-o', `-k ${pgdata}`],
    {
      env,
      stdio: 'inherit',
    },
  );
}

export async function runDbStopCommand(): Promise<void> {
  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);
  const pgdata = getPgDataOrThrow(env);

  await requireCommand('pg_ctl');
  await execa('pg_ctl', ['stop', '-D', pgdata], {
    env,
    stdio: 'inherit',
  });
}

export async function runDbStatusCommand(): Promise<void> {
  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);
  const pgdata = getPgDataOrThrow(env);

  if (!(await commandExists('pg_ctl'))) {
    logger.warn('pg_ctl is not available in PATH. Install PostgreSQL or enter the Nix devshell.');
    logger.info('Run `revealui doctor` for a full environment check.');
    return;
  }
  try {
    await execa('pg_ctl', ['status', '-D', pgdata], {
      env,
      stdio: 'inherit',
    });
  } catch (error) {
    if (isPgCtlNotRunningError(error)) {
      logger.warn(`PostgreSQL is not running (PGDATA: ${pgdata})`);
      return;
    }
    throw error;
  }
}

export async function runDbResetCommand(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force) {
    throw new Error('db reset is destructive. Re-run with --force.');
  }

  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);
  const pgdata = getPgDataOrThrow(env);

  if (await commandExists('pg_ctl')) {
    try {
      await execa('pg_ctl', ['stop', '-D', pgdata], { env, stdio: 'pipe' });
    } catch {
      // Ignore stop failures when server is not running.
    }
  }

  await fs.rm(pgdata, { recursive: true, force: true });
  await runDbInitCommand({ force: false });
}

export async function runDbMigrateCommand(): Promise<void> {
  const root = getWorkspaceRootOrThrow();
  const env = buildDbEnv(root);

  await execa('pnpm', ['--filter', '@revealui/db', 'db:migrate'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
}

export async function runDbCleanupCommand(
  options: { dryRun?: boolean; tables?: string } = {},
): Promise<void> {
  const root = getWorkspaceRootOrThrow();

  // Inherit ambient env (DATABASE_URL / POSTGRES_URL from vault/direnv),
  // not the local pg override used by other `db` subcommands.
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.dryRun) env.DRY_RUN = 'true';
  if (options.tables) env.TABLES = options.tables;

  await execa('pnpm', ['--filter', '@revealui/db', 'db:cleanup'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
}
