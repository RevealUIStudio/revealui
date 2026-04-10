import { commandExists, isTcpReachable } from '../utils/command.js';
import { detectDbTarget, resolveLocalDbConfig } from '../utils/db.js';
import { findWorkspaceRoot } from '../utils/workspace.js';
import {
  validateNeonUrl,
  validateNpmToken,
  validateStripeKey,
  validateSupabaseUrl,
} from '../validators/credentials.js';
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

/**
 * Credential and environment variable checks.
 *
 * Each entry defines: env var name, whether it's required or optional,
 * a human label, and an optional format validator.
 */
interface EnvVarSpec {
  key: string;
  label: string;
  required: boolean;
  validate?: (value: string) => { valid: boolean; message?: string };
}

const ENV_VAR_SPECS: EnvVarSpec[] = [
  // Core
  {
    key: 'REVEALUI_SECRET',
    label: 'App secret',
    required: false,
  },
  {
    key: 'REVEALUI_ADMIN_EMAIL',
    label: 'Admin email',
    required: false,
  },
  // Database
  {
    key: 'POSTGRES_URL',
    label: 'PostgreSQL URL',
    required: true,
    validate: validateNeonUrl,
  },
  // Stripe
  {
    key: 'STRIPE_SECRET_KEY',
    label: 'Stripe secret key',
    required: false,
    validate: validateStripeKey,
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    label: 'Stripe publishable key',
    required: false,
    validate: (v) => ({
      valid: v.startsWith('pk_test_') || v.startsWith('pk_live_'),
      message: 'Must start with pk_test_ or pk_live_',
    }),
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    label: 'Stripe webhook secret',
    required: false,
    validate: (v) => ({
      valid: v.startsWith('whsec_'),
      message: 'Must start with whsec_',
    }),
  },
  // Supabase
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    label: 'Supabase URL',
    required: false,
    validate: validateSupabaseUrl,
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    label: 'Supabase service role key',
    required: false,
    validate: (v) => ({
      valid: v.startsWith('eyJ'),
      message: 'Must be a JWT (starts with eyJ)',
    }),
  },
  // npm
  {
    key: 'NPM_TOKEN',
    label: 'npm publish token',
    required: false,
    validate: validateNpmToken,
  },
  // License
  {
    key: 'REVEALUI_LICENSE_PRIVATE_KEY',
    label: 'License signing key',
    required: false,
  },
  // CRON
  {
    key: 'REVEALUI_CRON_SECRET',
    label: 'Cron secret',
    required: false,
  },
  // AI (open-model inference)
  {
    key: 'INFERENCE_SNAPS_BASE_URL',
    label: 'Inference snaps base URL',
    required: false,
  },
  {
    key: 'OLLAMA_BASE_URL',
    label: 'Ollama base URL',
    required: false,
  },
];

function maskValue(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function gatherCredentialChecks(env: NodeJS.ProcessEnv): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  for (const spec of ENV_VAR_SPECS) {
    const value = env[spec.key];

    if (!value) {
      checks.push({
        id: `env:${spec.key}`,
        ok: !spec.required,
        detail: spec.required ? `${spec.label} — missing (required)` : `${spec.label} — not set`,
      });
      continue;
    }

    if (spec.validate) {
      const result = spec.validate(value);
      checks.push({
        id: `env:${spec.key}`,
        ok: result.valid,
        detail: result.valid
          ? `${spec.label} — ${maskValue(value)}`
          : `${spec.label} — ${result.message} (got ${maskValue(value)})`,
      });
    } else {
      checks.push({
        id: `env:${spec.key}`,
        ok: true,
        detail: `${spec.label} — set`,
      });
    }
  }

  return checks;
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
  const credentials = gatherCredentialChecks(env);

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
      ...credentials,
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
