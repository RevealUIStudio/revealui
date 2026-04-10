import { createLogger } from '@revealui/setup/utils';
import { execa } from 'execa';
import { formatDoctorReport, gatherDoctorReport } from '../runtime/doctor.js';
import { commandExists } from '../utils/command.js';
import { readDevConfig, writeDevConfig } from '../utils/dev-config.js';
import { findWorkspaceRoot } from '../utils/workspace.js';
import { runDbMigrateCommand, runDbStopCommand } from './db.js';
import { runDoctorCommand } from './doctor.js';
import { runShellCommand } from './shell.js';

const logger = createLogger({ prefix: 'Dev' });

export type DevService = 'mcp';
export type DevProfileName = 'local' | 'agent' | 'admin' | 'fullstack';

interface DevProfile {
  include?: DevService[];
  script?: string;
}

const DEV_PROFILES: Record<DevProfileName, DevProfile> = {
  local: {},
  agent: {
    include: ['mcp'],
  },
  admin: {
    script: 'dev:admin',
  },
  fullstack: {
    include: ['mcp'],
    script: 'dev',
  },
};

export interface DevUpOptions {
  ensure?: boolean;
  json?: boolean;
  dryRun?: boolean;
  fix?: boolean;
  script?: string;
  include?: string[];
  profile?: DevProfileName;
  inside?: boolean;
}

export interface DevPlan {
  profile: DevProfileName | 'custom';
  ensure: boolean;
  include: DevService[];
  script?: string;
  dryRun: boolean;
}

function getConfiguredProfile(): DevProfileName | undefined {
  const configured = readDevConfig().defaultProfile;
  if (configured && configured in DEV_PROFILES) {
    return configured as DevProfileName;
  }

  return undefined;
}

export function resolveDevUpOptions(options: DevUpOptions = {}): Required<
  Pick<DevUpOptions, 'ensure' | 'json' | 'inside'>
> & {
  profile?: DevProfileName;
  script?: string;
  include: DevService[];
} {
  const selectedProfile = options.profile ?? getConfiguredProfile();
  const profile = selectedProfile ? DEV_PROFILES[selectedProfile] : undefined;
  if (selectedProfile && !profile) {
    throw new Error(
      `Unknown dev profile "${selectedProfile}". Use one of: ${Object.keys(DEV_PROFILES).join(', ')}`,
    );
  }

  const include = Array.from(
    new Set([...(profile?.include ?? []), ...((options.include ?? []) as DevService[])]),
  );

  return {
    ensure: options.ensure ?? true,
    json: options.json ?? false,
    inside: options.inside ?? false,
    profile: selectedProfile,
    script: options.script ?? profile?.script,
    include,
  };
}

export function getDevPlan(options: DevUpOptions = {}): DevPlan {
  const resolved = resolveDevUpOptions(options);
  return {
    profile: resolved.profile ?? (options.include?.length || options.script ? 'custom' : 'local'),
    ensure: resolved.ensure,
    include: resolved.include,
    script: resolved.script,
    dryRun: options.dryRun ?? false,
  };
}

export function formatDevPlan(plan: DevPlan): string {
  const lines = ['', 'RevealUI Dev Plan', ''];
  lines.push(`profile   ${plan.profile}`);
  lines.push(`ensure    ${plan.ensure ? 'yes' : 'no'}`);
  lines.push(`dry-run   ${plan.dryRun ? 'yes' : 'no'}`);
  lines.push(`include   ${plan.include.length > 0 ? plan.include.join(', ') : 'none'}`);
  lines.push(`script    ${plan.script ?? 'none'}`);
  return lines.join('\n');
}

export function getDevActions(plan: DevPlan): string[] {
  const actions: string[] = [];

  if (plan.ensure) {
    actions.push('ensure local shell and database prerequisites');
  } else {
    actions.push('skip automatic shell/database ensure');
  }

  actions.push('run database migrations');

  if (shouldIncludeMcp(plan.include)) {
    actions.push('validate MCP credentials via `pnpm setup:mcp`');
  }

  if (plan.script) {
    actions.push(`start pnpm script \`${plan.script}\``);
  }

  return actions;
}

export function formatDevActions(plan: DevPlan): string {
  const actions = getDevActions(plan);
  const lines = ['', 'RevealUI Dev Actions', ''];
  for (const action of actions) {
    lines.push(`- ${action}`);
  }
  return lines.join('\n');
}

function shouldIncludeMcp(include: DevService[]): boolean {
  return include.includes('mcp');
}

export async function runDevUpCommand(options: DevUpOptions = {}): Promise<void> {
  const resolved = resolveDevUpOptions(options);
  const plan = getDevPlan(options);
  const forwardArgs: string[] = [];

  if (options.dryRun) {
    forwardArgs.push('--dry-run');
  }
  if (options.fix) {
    forwardArgs.push('--fix');
  }
  if (options.profile) {
    forwardArgs.push('--profile', options.profile);
  }
  for (const service of options.include ?? []) {
    forwardArgs.push('--include', service);
  }
  if (options.script) {
    forwardArgs.push('--script', options.script);
  }
  if (options.ensure === false) {
    forwardArgs.push('--no-ensure');
  }

  const reentered = await runShellCommand({
    ensure: resolved.ensure,
    json: resolved.json,
    inside: resolved.inside,
    forwardArgs,
  });
  if (reentered) {
    return;
  }

  if (resolved.json) {
    return;
  }

  process.stdout.write(`${formatDevPlan(plan)}\n`);
  process.stdout.write(`${formatDevActions(plan)}\n`);

  if (plan.dryRun) {
    logger.info('Dry run only; no migrations or services were started.');
    return;
  }

  if (options.fix) {
    await runDoctorCommand({ fix: true });
  }

  await runDbMigrateCommand();
  logger.success('Database migration complete');

  if (shouldIncludeMcp(resolved.include)) {
    const workspaceRoot = findWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error('RevealUI workspace root not found');
    }

    logger.info('Validating MCP setup');
    await execa('pnpm', ['setup:mcp'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
  }

  if (resolved.script) {
    const workspaceRoot = findWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error('RevealUI workspace root not found');
    }

    logger.info(`Starting dev script: ${resolved.script}`);
    await execa('pnpm', [resolved.script], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
  }
}

export async function runDevStatusCommand(options: DevUpOptions = {}): Promise<void> {
  const plan = getDevPlan(options);
  const forwardArgs: string[] = [];

  if (options.profile) {
    forwardArgs.push('--profile', options.profile);
  }
  for (const service of options.include ?? []) {
    forwardArgs.push('--include', service);
  }
  if (options.script) {
    forwardArgs.push('--script', options.script);
  }
  if (options.ensure === false) {
    forwardArgs.push('--no-ensure');
  }

  if (!(options.inside || process.env.IN_NIX_SHELL) && (await commandExists('nix'))) {
    const reentered = await runShellCommand({
      ensure: false,
      json: options.json,
      inside: options.inside,
      forwardArgs,
    });
    if (reentered) {
      return;
    }
  }

  const report = await gatherDoctorReport();

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ report, plan, actions: getDevActions(plan) }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`${formatDoctorReport(report)}\n`);
  process.stdout.write(`${formatDevPlan(plan)}\n`);
  process.stdout.write(`${formatDevActions(plan)}\n`);
}

export async function runDevDownCommand(): Promise<void> {
  await runDbStopCommand();
}

export async function runDevProfileSetCommand(profile: DevProfileName): Promise<void> {
  if (!(profile in DEV_PROFILES)) {
    throw new Error(
      `Unknown dev profile "${profile}". Use one of: ${Object.keys(DEV_PROFILES).join(', ')}`,
    );
  }

  const configPath = writeDevConfig({ defaultProfile: profile });
  logger.success(`Default dev profile set to "${profile}" in ${configPath}`);
}

export async function runDevProfileShowCommand(options: { json?: boolean } = {}): Promise<void> {
  const configuredProfile = getConfiguredProfile() ?? null;

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ defaultProfile: configuredProfile }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`Default dev profile: ${configuredProfile ?? 'not set'}\n`);
}
