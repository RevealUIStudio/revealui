import { commandExists, isTcpReachable } from '../utils/command.js';
import { detectDbTarget, resolveLocalDbConfig } from '../utils/db.js';
import { findWorkspaceRoot } from '../utils/workspace.js';
import { validateNodeVersion } from '../validators/node-version.js';

export interface DoctorCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  workspaceRoot: string | null;
  dbTarget: 'missing' | 'local' | 'remote';
  checks: DoctorCheck[];
}

function getMcpDetail(env: NodeJS.ProcessEnv): { ok: boolean; detail: string } {
  const configuredKeys = [
    env.VERCEL_API_KEY ? 'vercel' : null,
    env.STRIPE_SECRET_KEY ? 'stripe' : null,
  ].filter((value): value is string => value !== null);

  if (configuredKeys.length === 0) {
    return {
      ok: false,
      detail: 'mcp credentials missing (set VERCEL_API_KEY and/or STRIPE_SECRET_KEY)',
    };
  }

  return {
    ok: true,
    detail: `mcp credentials configured for ${configuredKeys.join(', ')}`,
  };
}

export async function gatherDoctorReport(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<DoctorReport> {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const dbConfig = resolveLocalDbConfig(workspaceRoot ?? cwd, env);
  const dbTarget = detectDbTarget(env.POSTGRES_URL || env.DATABASE_URL);

  const nodeOk = validateNodeVersion();
  const pnpmOk = await commandExists('pnpm');
  const nixOk = await commandExists('nix');
  const direnvActive = Boolean(env.DIRENV_FILE || env.DIRENV_DIR);
  const pgCtlOk = await commandExists('pg_ctl');
  const initdbOk = await commandExists('initdb');
  const dockerOk = await commandExists('docker');
  const postgresReachable =
    dbTarget === 'local' ? await isTcpReachable('127.0.0.1', 5432, 1000) : false;
  const mcp = getMcpDetail(env);

  return {
    workspaceRoot,
    dbTarget,
    checks: [
      {
        id: 'workspace',
        ok: workspaceRoot !== null,
        detail: workspaceRoot ?? 'RevealUI workspace root not found',
      },
      {
        id: 'node',
        ok: nodeOk,
        detail: process.version,
      },
      {
        id: 'pnpm',
        ok: pnpmOk,
        detail: pnpmOk ? 'pnpm available' : 'pnpm not found',
      },
      {
        id: 'nix',
        ok: nixOk,
        detail: nixOk ? 'nix available' : 'nix not found',
      },
      {
        id: 'direnv',
        ok: direnvActive,
        detail: direnvActive ? 'direnv active' : 'direnv not active',
      },
      {
        id: 'db-target',
        ok: dbTarget !== 'missing',
        detail:
          dbTarget === 'missing'
            ? 'No POSTGRES_URL or DATABASE_URL configured'
            : `${dbTarget} database target (${dbConfig.postgresUrl})`,
      },
      {
        id: 'pg_ctl',
        ok: pgCtlOk,
        detail: pgCtlOk ? 'pg_ctl available' : 'pg_ctl not found',
      },
      {
        id: 'initdb',
        ok: initdbOk,
        detail: initdbOk ? 'initdb available' : 'initdb not found',
      },
      {
        id: 'postgres',
        ok: dbTarget === 'local' ? postgresReachable : true,
        detail:
          dbTarget === 'local'
            ? postgresReachable
              ? 'local postgres reachable on 127.0.0.1:5432'
              : 'local postgres not reachable on 127.0.0.1:5432'
            : 'postgres reachability skipped for non-local target',
      },
      {
        id: 'docker',
        ok: dockerOk,
        detail: dockerOk ? 'docker available' : 'docker not found',
      },
      {
        id: 'mcp',
        ok: mcp.ok,
        detail: mcp.detail,
      },
    ],
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['', `RevealUI  ·  ${report.workspaceRoot ?? 'workspace not found'}`, ''];

  for (const check of report.checks) {
    lines.push(`${check.ok ? 'OK' : 'NO'}  ${check.id.padEnd(10)} ${check.detail}`);
  }

  return lines.join('\n');
}
