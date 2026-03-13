import fs from 'node:fs/promises';
import path from 'node:path';

export interface LocalDbConfig {
  pgdata: string;
  pghost: string;
  pgdatabase: string;
  pguser: string;
  postgresUrl: string;
  databaseUrl: string;
}

export function resolveLocalDbConfig(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): LocalDbConfig {
  const pgdata = env.PGDATA || path.join(cwd, '.pgdata');
  const pghost = env.PGHOST || pgdata;
  const pgdatabase = env.PGDATABASE || 'postgres';
  const pguser = env.PGUSER || 'postgres';
  const postgresUrl = env.POSTGRES_URL || 'postgresql://postgres@localhost:5432/postgres';
  const databaseUrl = env.DATABASE_URL || postgresUrl;

  return {
    pgdata,
    pghost,
    pgdatabase,
    pguser,
    postgresUrl,
    databaseUrl,
  };
}

export function isLocalDbUrl(url?: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function detectDbTarget(url?: string | null): 'missing' | 'local' | 'remote' {
  if (!url) return 'missing';
  return isLocalDbUrl(url) ? 'local' : 'remote';
}

export function buildPostgresConfig(pgdata: string): string {
  return `
# RevealUI Development Settings
listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
unix_socket_directories = '${pgdata}'
`.trimStart();
}

export function buildPgHbaConfig(): string {
  return `
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
`.trimStart();
}

export async function writeLocalDbConfigs(pgdata: string): Promise<void> {
  await fs.appendFile(path.join(pgdata, 'postgresql.conf'), buildPostgresConfig(pgdata), 'utf8');
  await fs.writeFile(path.join(pgdata, 'pg_hba.conf'), buildPgHbaConfig(), 'utf8');
}
