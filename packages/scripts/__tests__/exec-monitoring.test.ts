/**
 * Exec Monitoring Integration Tests
 */

import { getProcessStats, processRegistry } from '@revealui/core/monitoring';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execCommand, execParallel } from '../exec.js';
import { createLogger } from '../logger.js';

describe('Exec Monitoring Integration', () => {
  beforeEach(() => {
    processRegistry.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    processRegistry.clear();
  });

  it('bounds command fanout, retains ordered failures, and executes queued commands', async () => {
    let peak = 0;
    const observer = setInterval(() => {
      peak = Math.max(
        peak,
        processRegistry.getAll().filter((process) => process.status === 'running').length,
      );
    }, 5);
    try {
      const result = await execParallel(
        [0, 1, 2, 3, 4].map((index) => [
          process.execPath,
          ['-e', `setTimeout(() => { process.exitCode = ${index}; }, 100)`],
        ]),
        { capture: true },
      );
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(2);
      expect(result.success).toBe(false);
      expect(result.results[0]?.success, JSON.stringify(result.results)).toBe(true);
      expect(result.results.map((entry) => entry.exitCode)).toEqual([0, 1, 2, 3, 4]);
      expect(result.results.map((entry) => entry.success)).toEqual([
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(result.durationsMs.every((duration) => duration > 0)).toBe(true);
    } finally {
      clearInterval(observer);
    }
  });

  it('rejects invalid batch limits before launching commands and accepts empty batches', async () => {
    for (const concurrency of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      await expect(execParallel([['echo', ['never']]], { concurrency })).rejects.toThrow(
        'concurrency',
      );
    }
    expect(getProcessStats().total).toBe(0);
    expect(await execParallel([])).toEqual({ success: true, results: [], durationsMs: [] });
  });

  it('should register process on spawn', async () => {
    const initialStats = getProcessStats();
    const initialTotal = initialStats.total;

    // Execute a simple command
    const promise = execCommand('echo', ['test'], { capture: true });

    // Give it a moment to spawn
    await new Promise((resolve) => setTimeout(resolve, 100));

    const afterSpawnStats = getProcessStats();

    // Should have registered the process
    expect(afterSpawnStats.total).toBeGreaterThan(initialTotal);

    await promise;
  });

  it('should update process status on completion', async () => {
    // Execute a simple successful command
    const result = await execCommand('echo', ['test'], { capture: true });

    expect(result.success).toBe(true);

    // Check process registry
    const stats = getProcessStats();
    expect(stats.completed).toBeGreaterThan(0);
  });

  it('should update process status on failure', async () => {
    // Execute a command that will fail
    const result = await execCommand('false', [], { capture: true });

    expect(result.success).toBe(false);

    // Check process registry
    const stats = getProcessStats();
    expect(stats.failed).toBeGreaterThan(0);
  });

  it('should track process metadata', async () => {
    const metadata = { testId: 'test-123', type: 'integration' };

    await execCommand('echo', ['test'], {
      capture: true,
      metadata,
    });

    // Find the process with our metadata
    const allProcesses = processRegistry.getAll();
    const testProcess = allProcesses.find((p) => p.metadata?.testId === 'test-123');

    expect(testProcess).toBeDefined();
    expect(testProcess?.metadata?.type).toBe('integration');
  });

  it('should handle timeout gracefully', async () => {
    // Execute a command that will timeout (sleep longer than timeout)
    const result = await execCommand('sleep', ['10'], {
      capture: true,
      timeout: 100, // 100ms timeout
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      exitCode: 124,
      processExitCode: null,
      signal: 'SIGTERM',
      timedOut: true,
    });
  });

  it('retains actual nonzero exit and signal outcomes', async () => {
    const failed = await execCommand(process.execPath, ['-e', 'process.exit(7)'], {
      capture: true,
    });
    expect(failed).toMatchObject({
      success: false,
      exitCode: 7,
      processExitCode: 7,
      timedOut: false,
    });
    const signaled = await execCommand(
      process.execPath,
      ['-e', "process.kill(process.pid, 'SIGTERM')"],
      { capture: true },
    );
    expect(signaled).toMatchObject({
      success: false,
      processExitCode: null,
      signal: 'SIGTERM',
      timedOut: false,
    });
    expect(signaled.message).toContain('SIGTERM');
  });

  it('keeps a graceful zero exit after the deadline failed', async () => {
    const result = await execCommand(
      'sh',
      ['-c', 'trap "exit 0" TERM; echo ready; while :; do sleep 1; done'],
      { capture: true, timeout: 1000 },
    );
    expect(result.stdout).toContain('ready');
    expect(result).toMatchObject({
      success: false,
      exitCode: 124,
      processExitCode: 0,
      timedOut: true,
    });
  });

  it('cancels escalation after actual closure and logs no command arguments', async () => {
    const timers = vi.spyOn(globalThis, 'setTimeout');
    const canceled = vi.spyOn(globalThis, 'clearTimeout');
    const logger = createLogger({ level: 'silent' });
    const warning = vi.spyOn(logger, 'warn');
    const result = await execCommand(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)', 'synthetic-secret-argument'],
      { capture: true, timeout: 100, logger },
    );
    expect(result.timedOut).toBe(true);
    const escalation = timers.mock.calls.findIndex((call) => call[1] === 5000);
    expect(escalation).toBeGreaterThanOrEqual(0);
    expect(canceled).toHaveBeenCalledWith(timers.mock.results[escalation]?.value);
    expect(JSON.stringify(warning.mock.calls)).not.toContain('synthetic-secret-argument');
  });

  it('retains owned escalation when a real child abort emits an error before closure', async () => {
    const controller = new AbortController();
    const logger = createLogger({ level: 'silent' });
    // Abort after the runner records its deadline, exercising Node's actual
    // spawned-child error event rather than synthesizing an execution result.
    vi.spyOn(logger, 'warn').mockImplementation(() => controller.abort());
    const result = await execCommand(
      'sh',
      ['-c', 'trap "" TERM; echo abort-ready; while :; do sleep 1; done'],
      {
        capture: true,
        timeout: 1000,
        signal: controller.signal,
        logger,
      },
    );
    expect(result.stdout).toContain('abort-ready');
    expect(result).toMatchObject({
      success: false,
      exitCode: 124,
      processExitCode: null,
      signal: 'SIGKILL',
      timedOut: true,
    });
    expect(result.message).toContain('force-killed');
  }, 15000);

  it('force-kills owned live descendants after their group leader exits', async () => {
    const descendant =
      "process.on('SIGTERM', () => {}); process.send('ready'); setInterval(() => {}, 1000);";
    const script = `const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
child.once('message', () => { console.log('descendant ready'); process.exit(0); });`;
    const result = await execCommand(process.execPath, ['-e', script], {
      capture: true,
      timeout: 1000,
    });
    expect(result.stdout).toContain('descendant ready');
    expect(result).toMatchObject({
      success: false,
      exitCode: 124,
      processExitCode: 0,
      timedOut: true,
    });
    expect(result.message).toContain('force-killed');
  }, 15000);

  it('should track multiple processes', async () => {
    const initialStats = getProcessStats();

    // Execute multiple commands in parallel
    await Promise.all([
      execCommand('echo', ['test1'], { capture: true }),
      execCommand('echo', ['test2'], { capture: true }),
      execCommand('echo', ['test3'], { capture: true }),
    ]);

    const finalStats = getProcessStats();

    // Should have tracked all processes
    expect(finalStats.total).toBeGreaterThan(initialStats.total);
  });

  it('should track processes by source', async () => {
    await execCommand('echo', ['test'], { capture: true });

    const stats = getProcessStats();

    // Should have exec processes
    expect(stats.bySource.exec).toBeGreaterThan(0);
  });

  it('should calculate spawn rate', async () => {
    // Clear registry
    processRegistry.clear();

    // Spawn several processes
    await Promise.all([
      execCommand('echo', ['1'], { capture: true }),
      execCommand('echo', ['2'], { capture: true }),
      execCommand('echo', ['3'], { capture: true }),
    ]);

    const spawnRate = processRegistry.getSpawnRate();

    // Should have calculated a spawn rate
    expect(spawnRate).toBeGreaterThan(0);
  });
});
