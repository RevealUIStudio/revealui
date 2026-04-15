/**
 * CLI Commands: system scan / system tune / system revert
 *
 * Hardware-aware auto-config for RevealUI development environments.
 */

import type { PlanAction, TunePlan } from '@revealui/setup/system-tune';
import { detectSystem, generateAutoplan, matchProfile } from '@revealui/setup/system-tune';
import { createLogger } from '@revealui/setup/utils';

const logger = createLogger({ prefix: 'System' });

// =============================================================================
// Formatting
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatAction(action: PlanAction, index: number): string {
  const lines = [`  ${index + 1}. ${action.description}`, `     Target: ${action.target}`];
  if (action.current) lines.push(`     Current: ${action.current}`);
  lines.push(`     Desired: ${action.desired}`);
  if (action.privileged) lines.push(`     ⚠ Requires elevated privileges (sudo)`);
  return lines.join('\n');
}

function formatPlan(plan: TunePlan): string {
  const lines = [
    '',
    '════════════════════════════════════════════════',
    '  RevealUI System Tune Plan',
    '════════════════════════════════════════════════',
    '',
    `  Profile: ${plan.profileId}`,
    `  Platform: ${plan.system.platformClass}`,
    `  RAM: ${formatBytes(plan.system.memory.totalBytes)} total, ${formatBytes(plan.system.memory.freeBytes)} free`,
    `  CPU: ${plan.system.cpu.logicalCores} cores (${plan.system.cpu.physicalCores} physical)`,
    `  Disk: ${formatBytes(plan.system.disk.freeBytes)} free of ${formatBytes(plan.system.disk.totalBytes)}`,
    '',
  ];

  if (plan.isNoop) {
    lines.push('  ✓ System is already tuned — no changes needed.');
  } else {
    lines.push(`  ${plan.actions.length} action(s):`);
    lines.push('');
    for (let i = 0; i < plan.actions.length; i++) {
      lines.push(formatAction(plan.actions[i], i));
      lines.push('');
    }
  }

  lines.push('════════════════════════════════════════════════');
  return lines.join('\n');
}

function formatScanReport(system: ReturnType<typeof detectSystem>): string {
  const lines = [
    '',
    `  Platform:   ${system.platformClass}`,
    `  OS:         ${system.os.distro ?? `${system.os.platform} ${system.os.release}`}`,
    `  Arch:       ${system.os.arch}`,
    `  RAM:        ${formatBytes(system.memory.totalBytes)} total, ${formatBytes(system.memory.freeBytes)} free`,
    `  Swap:       ${formatBytes(system.memory.swapTotalBytes)} total`,
    `  CPU:        ${system.cpu.model}`,
    `  Cores:      ${system.cpu.logicalCores} logical, ${system.cpu.physicalCores} physical`,
    `  Disk:       ${formatBytes(system.disk.freeBytes)} free of ${formatBytes(system.disk.totalBytes)}`,
    '',
    '  Existing configs:',
    `    .wslconfig:    ${system.existingConfigs.wslconfig ? 'found' : 'not found'}`,
    `    earlyoom:      ${system.existingConfigs.earlyoom ? 'enabled' : 'not enabled'}`,
    `    Docker auto:   ${system.existingConfigs.dockerAutostart ? 'enabled' : 'disabled'}`,
    `    NODE_OPTIONS:  ${system.existingConfigs.nodeOptions ?? '(not set)'}`,
    '',
  ];
  return lines.join('\n');
}

// =============================================================================
// Commands
// =============================================================================

export interface SystemScanOptions {
  json?: boolean;
}

/** Read-only system scan — report hardware and platform detection. */
export async function runSystemScanCommand(options: SystemScanOptions): Promise<void> {
  const system = detectSystem();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(system, null, 2)}\n`);
    return;
  }

  logger.header('System Scan');
  process.stdout.write(`${formatScanReport(system)}\n`);

  const profile = matchProfile(system);
  if (profile) {
    process.stdout.write(`  Matching profile: ${profile.name} (${profile.id})\n`);
    process.stdout.write(`  Run 'revealui system tune' to apply.\n`);
  } else {
    process.stdout.write('  No matching profile — system looks well-configured.\n');
  }
}

export interface SystemTuneOptions {
  json?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

/** Generate and optionally apply a tuning plan. */
export async function runSystemTuneCommand(options: SystemTuneOptions): Promise<void> {
  const system = detectSystem();
  const plan = generateAutoplan(system);

  if (!plan) {
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ status: 'no-match', message: 'No matching profile' })}\n`,
      );
      return;
    }
    logger.info(
      'No matching tuning profile for this system. Run `revealui system scan` for details.',
    );
    return;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatPlan(plan)}\n`);

  if (plan.isNoop) return;

  if (options.dryRun) {
    process.stdout.write('  (dry-run mode — no changes applied)\n');
    return;
  }

  // Apply is not yet implemented — this is the detection + plan phase
  logger.info('Automatic apply is not yet implemented.');
  logger.info('Apply the changes above manually, or re-run with --json to pipe to automation.');
}

/** Revert a previously applied tuning plan from backup. */
export async function runSystemRevertCommand(): Promise<void> {
  // Placeholder — revert requires the apply phase to have stored backups
  logger.info('System revert is not yet implemented.');
  logger.info(
    'Backups will be stored in ~/.revealui/system-tune/backups/ once apply is available.',
  );
}
