/**
 * Plan Generator
 *
 * Pure function: (detected system state, profile) → plan of actions.
 * No I/O — only computes the diff between current and desired state.
 */

import { PROFILES } from './profiles.js';
import type { PlanAction, SystemInfo, TunePlan, TuneProfile } from './types.js';

// =============================================================================
// Profile Matching
// =============================================================================

/** Find the best matching profile for the detected system. */
export function matchProfile(system: SystemInfo): TuneProfile | null {
  const ramGb = system.memory.totalBytes / (1024 * 1024 * 1024);

  for (const profile of PROFILES) {
    if (profile.match.platform !== system.platformClass) continue;
    if (profile.match.maxHostRamGb !== undefined && ramGb > profile.match.maxHostRamGb) continue;
    if (profile.match.minHostRamGb !== undefined && ramGb < profile.match.minHostRamGb) continue;
    return profile;
  }

  return null;
}

// =============================================================================
// Action Generation
// =============================================================================

function generateWslActions(profile: TuneProfile, system: SystemInfo): PlanAction[] {
  const actions: PlanAction[] = [];
  const wsl = profile.tune.wslconfig;
  if (!wsl) return actions;

  const entries: Array<[string, string]> = [];
  if (wsl.memory) entries.push(['memory', wsl.memory]);
  if (wsl.processors !== undefined) entries.push(['processors', String(wsl.processors)]);
  if (wsl.swap) entries.push(['swap', wsl.swap]);
  if (wsl.vmIdleTimeout !== undefined) entries.push(['vmIdleTimeout', String(wsl.vmIdleTimeout)]);
  if (wsl.autoMemoryReclaim) entries.push(['autoMemoryReclaim', wsl.autoMemoryReclaim]);
  if (wsl.networkingMode) entries.push(['networkingMode', wsl.networkingMode]);

  if (entries.length > 0) {
    const desired = entries.map(([k, v]) => `${k}=${v}`).join(', ');
    actions.push({
      target: '.wslconfig [wsl2]',
      current: system.existingConfigs.wslconfig ? '(exists, values unknown)' : null,
      desired,
      privileged: false,
      description: `Set WSL2 config: ${desired}`,
    });
  }

  return actions;
}

function generateNodeActions(profile: TuneProfile, system: SystemInfo): PlanAction[] {
  const actions: PlanAction[] = [];
  const node = profile.tune.node;
  if (!node?.maxOldSpaceSize) return actions;

  const desired = `--max-old-space-size=${node.maxOldSpaceSize}`;
  const current = system.existingConfigs.nodeOptions;
  const alreadySet = current?.includes('max-old-space-size') ?? false;

  if (!alreadySet) {
    actions.push({
      target: 'NODE_OPTIONS',
      current,
      desired: current ? `${current} ${desired}` : desired,
      privileged: false,
      description: `Add ${desired} to NODE_OPTIONS in shell profile`,
    });
  }

  return actions;
}

function generateEarlyoomActions(profile: TuneProfile, system: SystemInfo): PlanAction[] {
  const actions: PlanAction[] = [];
  const oom = profile.tune.earlyoom;
  if (!oom?.enabled) return actions;

  if (!system.existingConfigs.earlyoom) {
    const args = [`-m ${oom.memThreshold ?? 5}`, `-s ${oom.swapThreshold ?? 10}`];
    if (oom.prefer) args.push(`--prefer '${oom.prefer}'`);

    actions.push({
      target: '/etc/default/earlyoom',
      current: null,
      desired: `EARLYOOM_ARGS="${args.join(' ')}"`,
      privileged: true,
      description: `Install and configure earlyoom (kill memory hogs before OOM killer)`,
    });
  }

  return actions;
}

function generateDockerActions(profile: TuneProfile, system: SystemInfo): PlanAction[] {
  const actions: PlanAction[] = [];
  const docker = profile.tune.docker;
  if (docker === undefined) return actions;

  if (!docker.autostart && system.existingConfigs.dockerAutostart) {
    actions.push({
      target: 'systemctl docker',
      current: 'enabled (autostart)',
      desired: 'disabled (on-demand via sudo systemctl start docker)',
      privileged: true,
      description: 'Disable Docker autostart to save ~200-400 MB RAM on boot',
    });
  }

  return actions;
}

function generateConcurrencyActions(profile: TuneProfile): PlanAction[] {
  const actions: PlanAction[] = [];

  if (profile.tune.pnpm?.childConcurrency) {
    actions.push({
      target: '.npmrc or pnpm config',
      current: null,
      desired: `child-concurrency=${profile.tune.pnpm.childConcurrency}`,
      privileged: false,
      description: `Limit pnpm child concurrency to ${profile.tune.pnpm.childConcurrency}`,
    });
  }

  if (profile.tune.turbo?.concurrency) {
    actions.push({
      target: 'turbo.json or TURBO_CONCURRENCY',
      current: null,
      desired: `concurrency=${profile.tune.turbo.concurrency}`,
      privileged: false,
      description: `Limit Turbo concurrency to ${profile.tune.turbo.concurrency}`,
    });
  }

  if (profile.tune.vitest?.maxThreads) {
    actions.push({
      target: 'vitest.config poolOptions.threads.maxThreads',
      current: null,
      desired: `maxThreads=${profile.tune.vitest.maxThreads}`,
      privileged: false,
      description: `Limit Vitest threads to ${profile.tune.vitest.maxThreads}`,
    });
  }

  return actions;
}

// =============================================================================
// Public API
// =============================================================================

/** Generate a tuning plan from detected system state and a profile. */
export function generatePlan(system: SystemInfo, profile: TuneProfile): TunePlan {
  const actions: PlanAction[] = [
    ...generateWslActions(profile, system),
    ...generateNodeActions(profile, system),
    ...generateEarlyoomActions(profile, system),
    ...generateDockerActions(profile, system),
    ...generateConcurrencyActions(profile),
  ];

  return {
    profileId: profile.id,
    system,
    actions,
    isNoop: actions.length === 0,
  };
}

/** Detect system, find matching profile, and generate plan. */
export function generateAutoplan(system: SystemInfo): TunePlan | null {
  const profile = matchProfile(system);
  if (!profile) return null;
  return generatePlan(system, profile);
}
