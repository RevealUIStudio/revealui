/**
 * Zombie Detector Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, callback: unknown) => {
    const cb = callback as (
      error: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;
    cb(null, { stdout: '', stderr: '' });
    return {};
  }),
}));

// Mock logger to avoid side effects
vi.mock('../../utils/logger-server.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock process-registry
vi.mock('../process-registry.js', () => ({
  processRegistry: {
    get: vi.fn(),
    markZombie: vi.fn(),
    getZombies: vi.fn(() => []),
  },
}));

import { exec } from 'node:child_process';
import { logger } from '../../utils/logger-server.js';
import { processRegistry } from '../process-registry.js';
import {
  getZombieCount,
  getZombieHistory,
  onZombieDetected,
  scanForZombies,
  startZombieDetection,
  stopZombieDetection,
  zombieDetector,
} from '../zombie-detector.js';

/**
 * Helper: set up exec mock to resolve commands in sequence.
 * Each call consumes the next response from the queue.
 * After the queue is exhausted, returns empty stdout.
 */
function setupExecResponses(responses: Array<{ stdout: string; error?: Error }>) {
  const queue = [...responses];
  vi.mocked(exec).mockImplementation((_cmd: unknown, callback: unknown) => {
    const cb = callback as (
      error: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;
    const next = queue.shift();
    if (next?.error) {
      cb(next.error, { stdout: '', stderr: '' });
    } else {
      cb(null, { stdout: next?.stdout ?? '', stderr: '' });
    }
    return {} as ReturnType<typeof exec>;
  });
}

describe('ZombieDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset detector to a clean state.
    // We must stop first, then manipulate enabled state carefully.
    zombieDetector.stop();
    zombieDetector.clearHistory();
    // Replace callback with no-op to clear any previous test's callback
    zombieDetector.onZombie(() => {});

    // Clear env vars that affect serverless detection
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;

    // Reset exec to default no-op (returns empty stdout)
    vi.mocked(exec).mockImplementation((_cmd: unknown, callback: unknown) => {
      const cb = callback as (
        error: Error | null,
        result: { stdout: string; stderr: string },
      ) => void;
      cb(null, { stdout: '', stderr: '' });
      return {} as ReturnType<typeof exec>;
    });
  });

  afterEach(() => {
    zombieDetector.stop();
    vi.useRealTimers();
  });

  /**
   * Helper to ensure the detector is stopped and enabled.
   * Because setEnabled(true) auto-starts when interval is null,
   * we call it then immediately stop to get a clean enabled+stopped state.
   */
  function ensureEnabledAndStopped() {
    zombieDetector.setEnabled(true);
    zombieDetector.stop();
  }

  describe('start', () => {
    it('should start the detection interval', () => {
      ensureEnabledAndStopped();

      zombieDetector.start();

      expect(zombieDetector.isRunning()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Starting zombie process detector',
        expect.objectContaining({ interval: expect.any(Number) }),
      );
    });

    it('should not start if already running', () => {
      ensureEnabledAndStopped();
      zombieDetector.start();
      vi.mocked(logger.info).mockClear();

      zombieDetector.start();

      expect(logger.info).not.toHaveBeenCalledWith(
        'Starting zombie process detector',
        expect.anything(),
      );
    });

    it('should not start if disabled', () => {
      zombieDetector.setEnabled(false);

      zombieDetector.start();

      expect(zombieDetector.isRunning()).toBe(false);
    });

    it('should skip on Vercel serverless environment', () => {
      ensureEnabledAndStopped();
      process.env.VERCEL = '1';

      zombieDetector.start();

      expect(zombieDetector.isRunning()).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'Zombie detection skipped  -  serverless environment detected',
      );
    });

    it('should skip on AWS Lambda environment', () => {
      ensureEnabledAndStopped();
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';

      zombieDetector.start();

      expect(zombieDetector.isRunning()).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'Zombie detection skipped  -  serverless environment detected',
      );
    });

    it('should trigger scan on interval tick', async () => {
      ensureEnabledAndStopped();

      zombieDetector.start();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(exec).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the detection interval', () => {
      ensureEnabledAndStopped();
      zombieDetector.start();
      expect(zombieDetector.isRunning()).toBe(true);

      zombieDetector.stop();
      expect(zombieDetector.isRunning()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Stopped zombie process detector');
    });

    it('should be safe to call stop when not running', () => {
      zombieDetector.stop();
      expect(zombieDetector.isRunning()).toBe(false);
    });

    it('should handle rapid start/stop cycles', () => {
      ensureEnabledAndStopped();
      zombieDetector.start();
      zombieDetector.stop();
      zombieDetector.start();
      zombieDetector.stop();

      expect(zombieDetector.isRunning()).toBe(false);
    });
  });

  describe('scan', () => {
    beforeEach(() => {
      ensureEnabledAndStopped();
    });

    it('should return empty array when no zombies found', async () => {
      setupExecResponses([{ stdout: '' }]);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
    });

    it('should return empty array when disabled', async () => {
      zombieDetector.setEnabled(false);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
      expect(exec).not.toHaveBeenCalled();
    });

    it('should detect a zombie process from ps output', async () => {
      // Responses: 1) ps scan, 2) parent check, 3) zombie re-check after 1s wait
      setupExecResponses([
        { stdout: '  1234  5678 node Z\n' },
        { stdout: '5678\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      // The attemptCleanup has a setTimeout(1000)  -  advance past it
      await vi.advanceTimersByTimeAsync(1500);
      const result = await scanPromise;

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(1234);
      expect(result[0].ppid).toBe(5678);
      expect(result[0].command).toBe('node');
      expect(result[0].detectedAt).toBeTypeOf('number');

      expect(processRegistry.markZombie).toHaveBeenCalledWith(1234);
      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie process detected',
        expect.objectContaining({ pid: 1234, ppid: 5678, command: 'node' }),
      );

      killSpy.mockRestore();
    });

    it('should detect multiple zombie processes', async () => {
      setupExecResponses([
        { stdout: '  1234  5678 node Z\n  2345  6789 python z\n' },
        { stdout: '5678\n' },
        { stdout: '' },
        { stdout: '6789\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await scanPromise;

      expect(result).toHaveLength(2);
      expect(result[0].pid).toBe(1234);
      expect(result[1].pid).toBe(2345);
      expect(result[1].command).toBe('python');

      killSpy.mockRestore();
    });

    it('should associate tracked process from registry', async () => {
      const trackedProcess = {
        pid: 1234,
        command: 'node',
        args: ['server.js'],
        source: 'exec' as const,
        status: 'running' as const,
        startTime: Date.now(),
      };

      setupExecResponses([
        { stdout: '  1234  5678 node Z\n' },
        { stdout: '5678\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(trackedProcess);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await scanPromise;

      expect(result[0].trackedProcess).toEqual(trackedProcess);
      expect(processRegistry.get).toHaveBeenCalledWith(1234);

      killSpy.mockRestore();
    });

    it('should handle ps command failure gracefully', async () => {
      setupExecResponses([{ stdout: '', error: new Error('ps command failed') }]);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to scan for zombie processes',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should skip malformed lines in ps output', async () => {
      setupExecResponses([{ stdout: '  not_a_valid_line\n  garbage data\n  HEADER PID PPID\n' }]);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
    });

    it('should handle lines with extra whitespace', async () => {
      setupExecResponses([
        { stdout: '    1234    5678    node    Z\n' },
        { stdout: '5678\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await scanPromise;

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(1234);

      killSpy.mockRestore();
    });

    it('should handle lowercase z state', async () => {
      setupExecResponses([
        { stdout: '  9999  1111 bash z\n' },
        { stdout: '1111\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await scanPromise;

      expect(result).toHaveLength(1);
      expect(result[0].pid).toBe(9999);
      expect(result[0].command).toBe('bash');

      killSpy.mockRestore();
    });

    it('should handle whitespace-only stdout from ps', async () => {
      setupExecResponses([{ stdout: '   \n  \n' }]);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
    });

    it('should handle lines that match grep output but not zombie regex', async () => {
      setupExecResponses([{ stdout: '  abc  def Zombie R\n' }]);

      const result = await zombieDetector.scan();

      expect(result).toEqual([]);
    });
  });

  describe('attemptCleanup (via scan)', () => {
    beforeEach(() => {
      ensureEnabledAndStopped();
    });

    it('should signal parent process with SIGCHLD when parent exists', async () => {
      setupExecResponses([
        { stdout: '  1234  5678 node Z\n' },
        { stdout: '5678\n' },
        { stdout: '' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(1500);
      await scanPromise;

      expect(killSpy).toHaveBeenCalledWith(5678, 'SIGCHLD');
      expect(logger.info).toHaveBeenCalledWith(
        'Zombie process successfully reaped',
        expect.objectContaining({ pid: 1234 }),
      );

      killSpy.mockRestore();
    });

    it('should report when parent process does not exist', async () => {
      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);

      const result = await zombieDetector.scan();

      expect(result).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie parent process does not exist',
        expect.objectContaining({ zombie: 1234, parent: 5678 }),
      );
    });

    it('should report when zombie persists after cleanup attempt', async () => {
      setupExecResponses([
        { stdout: '  1234  5678 node Z\n' },
        { stdout: '5678\n' },
        { stdout: 'Z\n' },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const scanPromise = zombieDetector.scan();
      await vi.advanceTimersByTimeAsync(1500);
      await scanPromise;

      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie process persists after cleanup attempt',
        expect.objectContaining({ pid: 1234, ppid: 5678 }),
      );

      killSpy.mockRestore();
    });

    it('should handle cleanup exec error gracefully', async () => {
      setupExecResponses([
        { stdout: '  1234  5678 node Z\n' },
        { stdout: '', error: new Error('permission denied') },
      ]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);

      const result = await zombieDetector.scan();

      expect(result).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup zombie process',
        expect.objectContaining({ zombie: 1234 }),
      );
    });

    it('should handle process.kill throwing', async () => {
      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '5678\n' }]);

      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const result = await zombieDetector.scan();

      expect(result).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup zombie process',
        expect.objectContaining({ zombie: 1234 }),
      );

      killSpy.mockRestore();
    });
  });

  describe('history management', () => {
    beforeEach(() => {
      ensureEnabledAndStopped();
      vi.mocked(processRegistry.get).mockReturnValue(undefined);
    });

    it('should add detected zombies to history', async () => {
      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);

      await zombieDetector.scan();

      const history = zombieDetector.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].pid).toBe(1234);
    });

    it('should return a copy of history (not a reference)', async () => {
      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);

      await zombieDetector.scan();

      const history1 = zombieDetector.getHistory();
      const history2 = zombieDetector.getHistory();
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });

    it('should order history with newest first (unshift)', async () => {
      setupExecResponses([{ stdout: '  100  200 first Z\n' }, { stdout: '' }]);
      await zombieDetector.scan();

      await vi.advanceTimersByTimeAsync(1000);
      setupExecResponses([{ stdout: '  300  400 second Z\n' }, { stdout: '' }]);
      await zombieDetector.scan();

      const history = zombieDetector.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].pid).toBe(300);
      expect(history[1].pid).toBe(100);
    });

    it('should trim history to maxHistory limit', async () => {
      for (let i = 0; i < 55; i++) {
        setupExecResponses([{ stdout: `  ${1000 + i}  ${2000 + i} proc${i} Z\n` }, { stdout: '' }]);
        await zombieDetector.scan();
      }

      const history = zombieDetector.getHistory();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should clear history', async () => {
      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);
      await zombieDetector.scan();

      expect(zombieDetector.getHistory()).toHaveLength(1);

      zombieDetector.clearHistory();
      expect(zombieDetector.getHistory()).toHaveLength(0);
    });
  });

  describe('getCount', () => {
    it('should delegate to processRegistry.getZombies', () => {
      vi.mocked(processRegistry.getZombies).mockReturnValue([
        { pid: 1, command: 'a', args: [], source: 'exec', status: 'zombie', startTime: 0 },
        { pid: 2, command: 'b', args: [], source: 'exec', status: 'zombie', startTime: 0 },
      ]);

      expect(zombieDetector.getCount()).toBe(2);
      expect(processRegistry.getZombies).toHaveBeenCalled();
    });

    it('should return 0 when no zombies in registry', () => {
      vi.mocked(processRegistry.getZombies).mockReturnValue([]);

      expect(zombieDetector.getCount()).toBe(0);
    });
  });

  describe('onZombie callback', () => {
    beforeEach(() => {
      ensureEnabledAndStopped();
      vi.mocked(processRegistry.get).mockReturnValue(undefined);
    });

    it('should invoke callback when zombie is detected', async () => {
      const callback = vi.fn();
      zombieDetector.onZombie(callback);

      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);

      await zombieDetector.scan();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ pid: 1234, ppid: 5678, command: 'node' }),
      );
    });

    it('should invoke callback for each zombie in a scan', async () => {
      const callback = vi.fn();
      zombieDetector.onZombie(callback);

      setupExecResponses([
        { stdout: '  100  200 a Z\n  300  400 b Z\n' },
        { stdout: '' },
        { stdout: '' },
      ]);

      await zombieDetector.scan();

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not invoke callback when no zombies found', async () => {
      const callback = vi.fn();
      zombieDetector.onZombie(callback);

      setupExecResponses([{ stdout: '' }]);

      await zombieDetector.scan();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should replace previous callback when called again', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      zombieDetector.onZombie(callback1);
      zombieDetector.onZombie(callback2);

      setupExecResponses([{ stdout: '  1234  5678 node Z\n' }, { stdout: '' }]);

      await zombieDetector.scan();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('setEnabled', () => {
    it('should enable the detector', () => {
      zombieDetector.setEnabled(false);
      expect(zombieDetector.isEnabled()).toBe(false);

      zombieDetector.setEnabled(true);
      expect(zombieDetector.isEnabled()).toBe(true);
    });

    it('should stop detector when disabled while running', () => {
      ensureEnabledAndStopped();
      zombieDetector.start();
      expect(zombieDetector.isRunning()).toBe(true);

      zombieDetector.setEnabled(false);
      expect(zombieDetector.isRunning()).toBe(false);
      expect(zombieDetector.isEnabled()).toBe(false);
    });

    it('should start detector when enabled while stopped', () => {
      zombieDetector.setEnabled(false);
      expect(zombieDetector.isRunning()).toBe(false);

      zombieDetector.setEnabled(true);
      expect(zombieDetector.isRunning()).toBe(true);
    });
  });

  describe('isEnabled / isRunning', () => {
    it('should report enabled state', () => {
      zombieDetector.setEnabled(false);
      expect(zombieDetector.isEnabled()).toBe(false);

      zombieDetector.setEnabled(true);
      expect(zombieDetector.isEnabled()).toBe(true);
    });

    it('should report running state correctly', () => {
      ensureEnabledAndStopped();
      expect(zombieDetector.isRunning()).toBe(false);

      zombieDetector.start();
      expect(zombieDetector.isRunning()).toBe(true);

      zombieDetector.stop();
      expect(zombieDetector.isRunning()).toBe(false);
    });
  });

  describe('convenience functions', () => {
    beforeEach(() => {
      ensureEnabledAndStopped();
    });

    it('startZombieDetection should start the detector', () => {
      startZombieDetection();
      expect(zombieDetector.isRunning()).toBe(true);
    });

    it('stopZombieDetection should stop the detector', () => {
      startZombieDetection();
      stopZombieDetection();
      expect(zombieDetector.isRunning()).toBe(false);
    });

    it('scanForZombies should return scan results', async () => {
      setupExecResponses([{ stdout: '' }]);
      const result = await scanForZombies();
      expect(result).toEqual([]);
    });

    it('getZombieHistory should return history', () => {
      const result = getZombieHistory();
      expect(result).toEqual([]);
    });

    it('getZombieCount should return count from registry', () => {
      vi.mocked(processRegistry.getZombies).mockReturnValue([]);
      const result = getZombieCount();
      expect(result).toBe(0);
    });

    it('onZombieDetected should register callback', async () => {
      vi.mocked(processRegistry.get).mockReturnValue(undefined);
      const callback = vi.fn();
      onZombieDetected(callback);

      setupExecResponses([{ stdout: '  1234  5678 test Z\n' }, { stdout: '' }]);

      await scanForZombies();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
