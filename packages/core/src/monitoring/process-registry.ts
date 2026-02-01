/**
 * Process Registry
 *
 * Central registry for tracking all spawned processes in the RevealUI system.
 * Maintains process lifecycle information and provides query capabilities.
 */

import type {
  TrackedProcess,
  ProcessSource,
  ProcessStatus,
  ProcessMetadata,
  RegistryStats,
} from './types.js';
import { DEFAULT_MONITORING_CONFIG } from './types.js';

/**
 * Global process registry instance
 */
class ProcessRegistry {
  private processes: Map<number, TrackedProcess> = new Map();
  private enabled: boolean = DEFAULT_MONITORING_CONFIG.enabled;
  private maxHistorySize: number = DEFAULT_MONITORING_CONFIG.maxHistorySize;

  /**
   * Register a new process
   */
  register(
    pid: number,
    command: string,
    args: string[],
    source: ProcessSource,
    metadata?: ProcessMetadata,
    ppid?: number
  ): void {
    if (!this.enabled) return;

    const process: TrackedProcess = {
      pid,
      command,
      args,
      source,
      status: 'running',
      startTime: Date.now(),
      metadata,
      ppid,
    };

    this.processes.set(pid, process);
    this.trimHistory();
  }

  /**
   * Update process status
   */
  updateStatus(
    pid: number,
    status: ProcessStatus,
    exitCode?: number,
    signal?: string
  ): void {
    if (!this.enabled) return;

    const process = this.processes.get(pid);
    if (!process) return;

    process.status = status;
    process.endTime = Date.now();

    if (exitCode !== undefined) {
      process.exitCode = exitCode;
    }

    if (signal !== undefined) {
      process.signal = signal;
    }
  }

  /**
   * Mark process as zombie
   */
  markZombie(pid: number): void {
    this.updateStatus(pid, 'zombie');
  }

  /**
   * Get process by PID
   */
  get(pid: number): TrackedProcess | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get all processes
   */
  getAll(): TrackedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by status
   */
  getByStatus(status: ProcessStatus): TrackedProcess[] {
    return this.getAll().filter((p) => p.status === status);
  }

  /**
   * Get processes by source
   */
  getBySource(source: ProcessSource): TrackedProcess[] {
    return this.getAll().filter((p) => p.source === source);
  }

  /**
   * Get running processes
   */
  getRunning(): TrackedProcess[] {
    return this.getByStatus('running');
  }

  /**
   * Get zombie processes
   */
  getZombies(): TrackedProcess[] {
    return this.getByStatus('zombie');
  }

  /**
   * Get failed processes
   */
  getFailed(): TrackedProcess[] {
    return this.getByStatus('failed');
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const all = this.getAll();
    const bySource: Record<ProcessSource, number> = {
      exec: 0,
      orchestration: 0,
      mcp: 0,
      'ai-runtime': 0,
      'dev-server': 0,
      database: 0,
      unknown: 0,
    };

    for (const process of all) {
      bySource[process.source]++;
    }

    return {
      total: all.length,
      running: this.getByStatus('running').length,
      completed: this.getByStatus('completed').length,
      failed: this.getByStatus('failed').length,
      zombies: this.getByStatus('zombie').length,
      killed: this.getByStatus('killed').length,
      bySource,
    };
  }

  /**
   * Calculate spawn rate (processes per minute)
   */
  getSpawnRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const recentProcesses = this.getAll().filter(
      (p) => p.startTime >= oneMinuteAgo
    );

    return recentProcesses.length;
  }

  /**
   * Clear completed/failed processes older than retention period
   */
  private trimHistory(): void {
    if (this.processes.size <= this.maxHistorySize) return;

    const processArray = Array.from(this.processes.entries());

    // Sort by end time (oldest first), then start time
    processArray.sort(([, a], [, b]) => {
      const aTime = a.endTime || a.startTime;
      const bTime = b.endTime || b.startTime;
      return aTime - bTime;
    });

    // Keep only running processes and recent completed/failed
    const toKeep = new Map<number, TrackedProcess>();
    let keptCount = 0;

    // First pass: keep all running and zombie processes
    for (const [pid, process] of processArray) {
      if (process.status === 'running' || process.status === 'zombie') {
        toKeep.set(pid, process);
        keptCount++;
      }
    }

    // Second pass: keep most recent completed/failed up to limit
    for (const [pid, process] of processArray.reverse()) {
      if (keptCount >= this.maxHistorySize) break;

      if (
        process.status !== 'running' &&
        process.status !== 'zombie' &&
        !toKeep.has(pid)
      ) {
        toKeep.set(pid, process);
        keptCount++;
      }
    }

    this.processes = toKeep;
  }

  /**
   * Clear all processes
   */
  clear(): void {
    this.processes.clear();
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Singleton instance
 */
export const processRegistry = new ProcessRegistry();

/**
 * Convenience functions
 */

export function registerProcess(
  pid: number,
  command: string,
  args: string[],
  source: ProcessSource,
  metadata?: ProcessMetadata,
  ppid?: number
): void {
  processRegistry.register(pid, command, args, source, metadata, ppid);
}

export function updateProcessStatus(
  pid: number,
  status: ProcessStatus,
  exitCode?: number,
  signal?: string
): void {
  processRegistry.updateStatus(pid, status, exitCode, signal);
}

export function markProcessZombie(pid: number): void {
  processRegistry.markZombie(pid);
}

export function getProcess(pid: number): TrackedProcess | undefined {
  return processRegistry.get(pid);
}

export function getAllProcesses(): TrackedProcess[] {
  return processRegistry.getAll();
}

export function getRunningProcesses(): TrackedProcess[] {
  return processRegistry.getRunning();
}

export function getZombieProcesses(): TrackedProcess[] {
  return processRegistry.getZombies();
}

export function getProcessStats(): RegistryStats {
  return processRegistry.getStats();
}

export function getSpawnRate(): number {
  return processRegistry.getSpawnRate();
}
