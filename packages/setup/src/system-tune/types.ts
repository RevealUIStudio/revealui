/**
 * System Tune Types
 *
 * Shared types for hardware detection, tuning profiles, and plan generation.
 */

// =============================================================================
// Platform Detection
// =============================================================================

export type PlatformClass =
  | 'wsl2'
  | 'linux'
  | 'macos'
  | 'windows'
  | 'docker'
  | 'cloud-vm'
  | 'unknown';

export interface SystemInfo {
  /** OS/distro/kernel identification */
  os: {
    platform: NodeJS.Platform;
    release: string;
    arch: string;
    distro?: string;
  };
  /** Detected platform class */
  platformClass: PlatformClass;
  /** Memory in bytes */
  memory: {
    totalBytes: number;
    freeBytes: number;
    swapTotalBytes: number;
    swapFreeBytes: number;
  };
  /** CPU info */
  cpu: {
    model: string;
    physicalCores: number;
    logicalCores: number;
  };
  /** Disk info for the working directory */
  disk: {
    totalBytes: number;
    freeBytes: number;
  };
  /** Existing configs already present */
  existingConfigs: {
    wslconfig: boolean;
    earlyoom: boolean;
    dockerAutostart: boolean;
    nodeOptions: string | null;
  };
}

// =============================================================================
// Tuning Profile
// =============================================================================

export interface WslConfigTune {
  memory?: string;
  processors?: number;
  swap?: string;
  vmIdleTimeout?: number;
  autoMemoryReclaim?: string;
  networkingMode?: string;
}

export interface TuneValues {
  wslconfig?: WslConfigTune;
  node?: { maxOldSpaceSize?: number };
  pnpm?: { childConcurrency?: number };
  turbo?: { concurrency?: number };
  vitest?: { maxThreads?: number };
  earlyoom?: {
    enabled?: boolean;
    memThreshold?: number;
    swapThreshold?: number;
    prefer?: string;
  };
  docker?: { autostart?: boolean };
  macos?: { maxFiles?: number; spotlightExclusions?: string[] };
  windows?: { defenderExclusions?: string[]; longPaths?: boolean };
}

export interface TuneProfile {
  id: string;
  name: string;
  description: string;
  version: string;
  origin?: string;
  match: {
    platform: PlatformClass;
    maxHostRamGb?: number;
    minHostRamGb?: number;
  };
  tune: TuneValues;
}

// =============================================================================
// Plan
// =============================================================================

export interface PlanAction {
  /** What file or setting is being changed */
  target: string;
  /** What the current value is (null if not set) */
  current: string | null;
  /** What the new value will be */
  desired: string;
  /** Whether this requires elevated privileges */
  privileged: boolean;
  /** Human-readable description */
  description: string;
}

export interface TunePlan {
  /** Profile that generated this plan */
  profileId: string;
  /** Detected system info */
  system: SystemInfo;
  /** Actions to take */
  actions: PlanAction[];
  /** Whether all actions are no-ops (system already tuned) */
  isNoop: boolean;
}
