/**
 * Process Registry Tests
 *
 * Comprehensive tests for ProcessRegistry class and convenience functions
 * including registration, status updates, queries, history trimming,
 * enable/disable, and spawn rate calculation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAllProcesses,
  getProcess,
  getProcessStats,
  getRunningProcesses,
  getSpawnRate,
  getZombieProcesses,
  markProcessZombie,
  processRegistry,
  registerProcess,
  updateProcessStatus,
} from '../process-registry.js';

describe('ProcessRegistry', () => {
  beforeEach(() => {
    processRegistry.setEnabled(true);
    processRegistry.clear();
  });

  afterEach(() => {
    processRegistry.setEnabled(true);
  });

  describe('register', () => {
    it('should register a new process', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      const proc = processRegistry.get(1234);
      expect(proc).toBeDefined();
      expect(proc?.pid).toBe(1234);
      expect(proc?.command).toBe('node');
      expect(proc?.args).toEqual(['test.js']);
      expect(proc?.source).toBe('exec');
      expect(proc?.status).toBe('running');
    });

    it('should register process with metadata and ppid', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec', { taskId: 'task-1' }, 5678);

      const proc = processRegistry.get(1234);
      expect(proc?.metadata).toEqual({ taskId: 'task-1' });
      expect(proc?.ppid).toBe(5678);
    });

    it('should set startTime on registration', () => {
      const before = Date.now();
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      const after = Date.now();

      const proc = processRegistry.get(1234);
      expect(proc?.startTime).toBeGreaterThanOrEqual(before);
      expect(proc?.startTime).toBeLessThanOrEqual(after);
    });

    it('should not register when disabled', () => {
      processRegistry.setEnabled(false);
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      expect(processRegistry.get(1234)).toBeUndefined();
    });

    it('should register with different sources', () => {
      processRegistry.register(1, 'cmd', [], 'exec');
      processRegistry.register(2, 'cmd', [], 'orchestration');
      processRegistry.register(3, 'cmd', [], 'mcp');
      processRegistry.register(4, 'cmd', [], 'ai-runtime');
      processRegistry.register(5, 'cmd', [], 'dev-server');
      processRegistry.register(6, 'cmd', [], 'database');
      processRegistry.register(7, 'cmd', [], 'unknown');

      expect(processRegistry.getAll()).toHaveLength(7);
    });

    it('should overwrite existing process with same PID', () => {
      processRegistry.register(1234, 'node', ['old.js'], 'exec');
      processRegistry.register(1234, 'python', ['new.py'], 'mcp');

      const proc = processRegistry.get(1234);
      expect(proc?.command).toBe('python');
      expect(proc?.args).toEqual(['new.py']);
      expect(proc?.source).toBe('mcp');
    });

    it('should register without optional metadata', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      const proc = processRegistry.get(1234);
      expect(proc?.metadata).toBeUndefined();
      expect(proc?.ppid).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update process status', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'completed', 0);

      const proc = processRegistry.get(1234);
      expect(proc?.status).toBe('completed');
      expect(proc?.exitCode).toBe(0);
      expect(proc?.endTime).toBeDefined();
    });

    it('should update status with signal', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'killed', undefined, 'SIGTERM');

      const proc = processRegistry.get(1234);
      expect(proc?.status).toBe('killed');
      expect(proc?.signal).toBe('SIGTERM');
    });

    it('should set endTime on status update', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      const before = Date.now();
      processRegistry.updateStatus(1234, 'completed', 0);
      const after = Date.now();

      const proc = processRegistry.get(1234);
      expect(proc?.endTime).toBeGreaterThanOrEqual(before);
      expect(proc?.endTime).toBeLessThanOrEqual(after);
    });

    it('should do nothing for non-existent PID', () => {
      processRegistry.updateStatus(9999, 'completed', 0);

      expect(processRegistry.get(9999)).toBeUndefined();
    });

    it('should do nothing when disabled', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.setEnabled(false);
      processRegistry.updateStatus(1234, 'completed', 0);

      const proc = processRegistry.get(1234);
      expect(proc?.status).toBe('running');
    });

    it('should update status to failed with non-zero exit code', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'failed', 1);

      const proc = processRegistry.get(1234);
      expect(proc?.status).toBe('failed');
      expect(proc?.exitCode).toBe(1);
    });

    it('should not set exitCode when undefined', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'killed');

      const proc = processRegistry.get(1234);
      expect(proc?.exitCode).toBeUndefined();
    });

    it('should not set signal when undefined', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'completed', 0);

      const proc = processRegistry.get(1234);
      expect(proc?.signal).toBeUndefined();
    });
  });

  describe('markZombie', () => {
    it('should mark process as zombie', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.markZombie(1234);

      const proc = processRegistry.get(1234);
      expect(proc?.status).toBe('zombie');
    });

    it('should set endTime when marking as zombie', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.markZombie(1234);

      const proc = processRegistry.get(1234);
      expect(proc?.endTime).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no processes registered', () => {
      expect(processRegistry.getAll()).toHaveLength(0);
    });

    it('should return all registered processes', () => {
      processRegistry.register(1, 'a', [], 'exec');
      processRegistry.register(2, 'b', [], 'mcp');
      processRegistry.register(3, 'c', [], 'database');

      expect(processRegistry.getAll()).toHaveLength(3);
    });
  });

  describe('getByStatus', () => {
    it('should return processes by status', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');
      processRegistry.updateStatus(1234, 'completed', 0);

      const running = processRegistry.getByStatus('running');
      const completed = processRegistry.getByStatus('completed');

      expect(running).toHaveLength(1);
      expect(running[0].pid).toBe(5678);
      expect(completed).toHaveLength(1);
      expect(completed[0].pid).toBe(1234);
    });

    it('should return empty array when no processes match status', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      expect(processRegistry.getByStatus('failed')).toHaveLength(0);
      expect(processRegistry.getByStatus('zombie')).toHaveLength(0);
      expect(processRegistry.getByStatus('killed')).toHaveLength(0);
    });
  });

  describe('getBySource', () => {
    it('should return processes by source', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'mcp', ['server'], 'mcp');

      const execProcesses = processRegistry.getBySource('exec');
      const mcpProcesses = processRegistry.getBySource('mcp');

      expect(execProcesses).toHaveLength(1);
      expect(execProcesses[0].pid).toBe(1234);
      expect(mcpProcesses).toHaveLength(1);
      expect(mcpProcesses[0].pid).toBe(5678);
    });

    it('should return empty array when no processes match source', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      expect(processRegistry.getBySource('mcp')).toHaveLength(0);
      expect(processRegistry.getBySource('database')).toHaveLength(0);
    });
  });

  describe('getRunning', () => {
    it('should return only running processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');
      processRegistry.updateStatus(1234, 'completed', 0);

      const running = processRegistry.getRunning();
      expect(running).toHaveLength(1);
      expect(running[0].pid).toBe(5678);
    });
  });

  describe('getZombies', () => {
    it('should return only zombie processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');
      processRegistry.markZombie(1234);

      const zombies = processRegistry.getZombies();
      expect(zombies).toHaveLength(1);
      expect(zombies[0].pid).toBe(1234);
    });
  });

  describe('getFailed', () => {
    it('should return only failed processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');
      processRegistry.updateStatus(1234, 'failed', 1);

      const failed = processRegistry.getFailed();
      expect(failed).toHaveLength(1);
      expect(failed[0].pid).toBe(1234);
      expect(failed[0].exitCode).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');
      processRegistry.register(9012, 'mcp', ['server'], 'mcp');
      processRegistry.updateStatus(1234, 'completed', 0);
      processRegistry.markZombie(9012);

      const stats = processRegistry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.zombies).toBe(1);
      expect(stats.bySource.exec).toBe(2);
      expect(stats.bySource.mcp).toBe(1);
    });

    it('should return zero stats when empty', () => {
      const stats = processRegistry.getStats();

      expect(stats.total).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.zombies).toBe(0);
      expect(stats.killed).toBe(0);
    });

    it('should count killed processes', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.updateStatus(1234, 'killed', undefined, 'SIGKILL');

      const stats = processRegistry.getStats();
      expect(stats.killed).toBe(1);
    });

    it('should count all sources correctly', () => {
      processRegistry.register(1, 'a', [], 'exec');
      processRegistry.register(2, 'b', [], 'orchestration');
      processRegistry.register(3, 'c', [], 'mcp');
      processRegistry.register(4, 'd', [], 'ai-runtime');
      processRegistry.register(5, 'e', [], 'dev-server');
      processRegistry.register(6, 'f', [], 'database');
      processRegistry.register(7, 'g', [], 'unknown');

      const stats = processRegistry.getStats();
      expect(stats.bySource.exec).toBe(1);
      expect(stats.bySource.orchestration).toBe(1);
      expect(stats.bySource.mcp).toBe(1);
      expect(stats.bySource['ai-runtime']).toBe(1);
      expect(stats.bySource['dev-server']).toBe(1);
      expect(stats.bySource.database).toBe(1);
      expect(stats.bySource.unknown).toBe(1);
    });
  });

  describe('getSpawnRate', () => {
    it('should calculate spawn rate for processes in last minute', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');

      // Both registered just now, so both within last minute
      const rate = processRegistry.getSpawnRate();
      expect(rate).toBe(2);
    });

    it('should exclude processes older than one minute', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');

      // Manually set one to be old
      const p2 = processRegistry.get(5678);
      if (p2) p2.startTime = Date.now() - 90_000;

      const rate = processRegistry.getSpawnRate();
      expect(rate).toBe(1);
    });

    it('should return zero when no recent processes', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      const proc = processRegistry.get(1234);
      if (proc) proc.startTime = Date.now() - 120_000;

      const rate = processRegistry.getSpawnRate();
      expect(rate).toBe(0);
    });

    it('should return zero when registry is empty', () => {
      expect(processRegistry.getSpawnRate()).toBe(0);
    });
  });

  describe('trimHistory', () => {
    it('should trim old completed processes when exceeding maxHistorySize', () => {
      // Default maxHistorySize is 1000. We can't easily change it on the singleton,
      // but we can verify trimming works by registering many processes.
      // The trimHistory runs on each register, so we need to exceed the limit.

      // Register 1001 processes to trigger trim
      for (let i = 0; i < 1001; i++) {
        processRegistry.register(i, 'node', ['test.js'], 'exec');
        if (i < 1000) {
          processRegistry.updateStatus(i, 'completed', 0);
        }
      }

      // Should have trimmed down
      const all = processRegistry.getAll();
      expect(all.length).toBeLessThanOrEqual(1000);
    });

    it('should preserve running and zombie processes during trim', () => {
      // Register many completed processes, then running ones
      for (let i = 0; i < 999; i++) {
        processRegistry.register(i, 'node', ['test.js'], 'exec');
        processRegistry.updateStatus(i, 'completed', 0);
      }

      // Register running process
      processRegistry.register(10000, 'node', ['running.js'], 'exec');
      // Register zombie
      processRegistry.register(10001, 'node', ['zombie.js'], 'exec');
      processRegistry.markZombie(10001);

      // Trigger trim by adding more
      processRegistry.register(10002, 'node', ['trigger.js'], 'exec');

      // Running and zombie should still be present
      expect(processRegistry.get(10000)?.status).toBe('running');
      expect(processRegistry.get(10001)?.status).toBe('zombie');
      expect(processRegistry.get(10002)?.status).toBe('running');
    });
  });

  describe('clear', () => {
    it('should clear all processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec');
      processRegistry.register(5678, 'node', ['test2.js'], 'exec');

      processRegistry.clear();

      expect(processRegistry.getAll()).toHaveLength(0);
    });
  });

  describe('enabled state', () => {
    it('should respect enabled state for register', () => {
      processRegistry.setEnabled(false);
      processRegistry.register(1234, 'node', ['test.js'], 'exec');

      expect(processRegistry.get(1234)).toBeUndefined();

      processRegistry.setEnabled(true);
      processRegistry.register(5678, 'node', ['test.js'], 'exec');

      expect(processRegistry.get(5678)).toBeDefined();
    });

    it('should respect enabled state for updateStatus', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec');
      processRegistry.setEnabled(false);
      processRegistry.updateStatus(1234, 'completed', 0);

      expect(processRegistry.get(1234)?.status).toBe('running');
    });

    it('should report correct enabled state', () => {
      expect(processRegistry.isEnabled()).toBe(true);

      processRegistry.setEnabled(false);
      expect(processRegistry.isEnabled()).toBe(false);

      processRegistry.setEnabled(true);
      expect(processRegistry.isEnabled()).toBe(true);
    });
  });

  describe('convenience functions', () => {
    it('registerProcess should delegate to processRegistry.register', () => {
      registerProcess(1234, 'node', ['test.js'], 'exec', { key: 'val' }, 999);

      const proc = processRegistry.get(1234);
      expect(proc).toBeDefined();
      expect(proc?.pid).toBe(1234);
      expect(proc?.metadata).toEqual({ key: 'val' });
      expect(proc?.ppid).toBe(999);
    });

    it('updateProcessStatus should delegate to processRegistry.updateStatus', () => {
      registerProcess(1234, 'node', ['test.js'], 'exec');
      updateProcessStatus(1234, 'completed', 0);

      expect(processRegistry.get(1234)?.status).toBe('completed');
    });

    it('markProcessZombie should delegate to processRegistry.markZombie', () => {
      registerProcess(1234, 'node', ['test.js'], 'exec');
      markProcessZombie(1234);

      expect(processRegistry.get(1234)?.status).toBe('zombie');
    });

    it('getProcess should delegate to processRegistry.get', () => {
      registerProcess(1234, 'node', ['test.js'], 'exec');

      const proc = getProcess(1234);
      expect(proc?.pid).toBe(1234);
    });

    it('getProcess should return undefined for non-existent PID', () => {
      expect(getProcess(9999)).toBeUndefined();
    });

    it('getAllProcesses should delegate to processRegistry.getAll', () => {
      registerProcess(1, 'a', [], 'exec');
      registerProcess(2, 'b', [], 'mcp');

      expect(getAllProcesses()).toHaveLength(2);
    });

    it('getRunningProcesses should delegate to processRegistry.getRunning', () => {
      registerProcess(1, 'a', [], 'exec');
      registerProcess(2, 'b', [], 'exec');
      updateProcessStatus(1, 'completed', 0);

      const running = getRunningProcesses();
      expect(running).toHaveLength(1);
      expect(running[0].pid).toBe(2);
    });

    it('getZombieProcesses should delegate to processRegistry.getZombies', () => {
      registerProcess(1, 'a', [], 'exec');
      markProcessZombie(1);

      const zombies = getZombieProcesses();
      expect(zombies).toHaveLength(1);
    });

    it('getProcessStats should delegate to processRegistry.getStats', () => {
      registerProcess(1, 'a', [], 'exec');
      registerProcess(2, 'b', [], 'mcp');

      const stats = getProcessStats();
      expect(stats.total).toBe(2);
      expect(stats.running).toBe(2);
    });

    it('getSpawnRate should delegate to processRegistry.getSpawnRate', () => {
      registerProcess(1, 'a', [], 'exec');

      const rate = getSpawnRate();
      expect(rate).toBe(1);
    });
  });
});
