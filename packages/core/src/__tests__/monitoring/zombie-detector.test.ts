import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before imports
vi.mock('../../utils/logger-server.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../monitoring/process-registry.js', () => ({
  processRegistry: {
    get: vi.fn(),
    markZombie: vi.fn(),
    getZombies: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}))

vi.mock('node:util', () => ({
  promisify: vi.fn((fn: unknown) => fn),
}))

vi.mock('../../monitoring/types.js', () => ({
  DEFAULT_MONITORING_CONFIG: {
    enabled: true,
    zombieDetectionInterval: 30_000,
    healthCheckInterval: 5_000,
    maxZombieHistory: 50,
    maxHistorySize: 1000,
    alertThresholds: {
      zombies: { warning: 3, critical: 5 },
      memory: { warning: 512, critical: 1024 },
      processes: { active: { warning: 50, critical: 100 } },
      database: { waiting: { warning: 5, critical: 10 } },
      spawnRate: { warning: 20, critical: 50 },
    },
  },
}))

import { exec } from 'node:child_process'
import { processRegistry } from '../../monitoring/process-registry.js'
import {
  getZombieCount,
  getZombieHistory,
  onZombieDetected,
  scanForZombies,
  startZombieDetection,
  stopZombieDetection,
  zombieDetector,
} from '../../monitoring/zombie-detector.js'
import { logger } from '../../utils/logger-server.js'

const mockExec = vi.mocked(exec)

/**
 * Helper to run a scan and advance fake timers for the 1-second cleanup delay.
 * Each zombie found triggers a cleanup with `setTimeout(resolve, 1000)`.
 */
async function runScanWithTimers(
  expectedZombies: number = 1,
): Promise<ReturnType<typeof zombieDetector.scan>> {
  const scanPromise = zombieDetector.scan()
  // Each zombie cleanup has a 1-second setTimeout
  for (let i = 0; i < expectedZombies; i++) {
    await vi.advanceTimersByTimeAsync(1000)
  }
  return scanPromise
}

describe('ZombieDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    zombieDetector.stop()
    zombieDetector.clearHistory()
    // Enable without leaving the interval running:
    // setEnabled(true) calls start() when no interval, so we stop immediately after
    zombieDetector.setEnabled(false)
    zombieDetector.setEnabled(true)
    zombieDetector.stop()
    vi.clearAllMocks()

    delete process.env.VERCEL
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
  })

  afterEach(() => {
    zombieDetector.stop()
    vi.useRealTimers()
  })

  describe('start / stop', () => {
    it('starts the detector interval', () => {
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(true)
      expect(logger.info).toHaveBeenCalledWith(
        'Starting zombie process detector',
        expect.any(Object),
      )
    })

    it('stops the detector interval', () => {
      zombieDetector.start()
      zombieDetector.stop()
      expect(zombieDetector.isRunning()).toBe(false)
      expect(logger.info).toHaveBeenCalledWith('Stopped zombie process detector')
    })

    it('does not start when disabled', () => {
      zombieDetector.setEnabled(false)
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(false)
    })

    it('does not start again if already running', () => {
      zombieDetector.start()
      const firstCallCount = vi.mocked(logger.info).mock.calls.length

      zombieDetector.start()
      expect(vi.mocked(logger.info).mock.calls.length).toBe(firstCallCount)
    })

    it('skips on Vercel serverless environment', () => {
      process.env.VERCEL = '1'
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(false)
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('serverless'))
    })

    it('skips on AWS Lambda environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-func'
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(false)
    })

    it('stop is a no-op when not running', () => {
      zombieDetector.stop()
      expect(zombieDetector.isRunning()).toBe(false)
    })
  })

  describe('scan', () => {
    it('returns empty array when no zombies found', async () => {
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      const result = await zombieDetector.scan()
      expect(result).toEqual([])
    })

    it('returns empty array when disabled', async () => {
      zombieDetector.setEnabled(false)
      const result = await zombieDetector.scan()
      expect(result).toEqual([])
      expect(mockExec).not.toHaveBeenCalled()
    })

    it('detects zombie processes from ps output', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  1234  5678  node  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '5678\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      vi.mocked(processRegistry.get).mockReturnValue(undefined)

      const result = await runScanWithTimers(1)

      expect(result).toHaveLength(1)
      expect(result[0].pid).toBe(1234)
      expect(result[0].ppid).toBe(5678)
      expect(result[0].command).toBe('node')
      expect(result[0].detectedAt).toBeDefined()

      expect(processRegistry.markZombie).toHaveBeenCalledWith(1234)
      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie process detected',
        expect.objectContaining({ pid: 1234, ppid: 5678, command: 'node' }),
      )

      killSpy.mockRestore()
    })

    it('parses multiple zombie lines', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({
          stdout: '  100  1  defunct  Z\n  200  1  worker  Z\n',
          stderr: '',
        } as never)
        .mockResolvedValueOnce({ stdout: '1\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '1\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      const result = await runScanWithTimers(2)
      expect(result).toHaveLength(2)

      killSpy.mockRestore()
    })

    it('handles exec failure gracefully', async () => {
      mockExec.mockRejectedValueOnce(new Error('ps not found'))

      const result = await zombieDetector.scan()
      expect(result).toEqual([])
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to scan for zombie processes',
        expect.any(Object),
      )
    })

    it('calls onZombieDetected callback', async () => {
      const callback = vi.fn()
      zombieDetector.onZombie(callback)

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  999  1  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '1\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      await runScanWithTimers(1)

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ pid: 999 }))

      killSpy.mockRestore()
    })

    it('associates tracked process when available', async () => {
      const trackedProcess = {
        pid: 1234,
        command: 'node',
        args: ['server.js'],
        source: 'exec' as const,
        status: 'running' as const,
        startTime: Date.now(),
      }
      vi.mocked(processRegistry.get).mockReturnValue(trackedProcess)

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  1234  5678  node  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '5678\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      const result = await runScanWithTimers(1)
      expect(result[0].trackedProcess).toBe(trackedProcess)

      killSpy.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('signals parent with SIGCHLD when parent exists', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  100  200  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '200\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      await runScanWithTimers(1)

      expect(killSpy).toHaveBeenCalledWith(200, 'SIGCHLD')
      expect(logger.info).toHaveBeenCalledWith(
        'Zombie process successfully reaped',
        expect.objectContaining({ pid: 100 }),
      )

      killSpy.mockRestore()
    })

    it('warns when parent process does not exist', async () => {
      mockExec
        .mockResolvedValueOnce({ stdout: '  100  200  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never) // parent doesn't exist

      // No setTimeout in this path, so no timer advance needed
      await zombieDetector.scan()

      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie parent process does not exist',
        expect.objectContaining({ zombie: 100, parent: 200 }),
      )
    })

    it('warns when zombie persists after cleanup', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  100  200  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '200\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: 'Z\n', stderr: '' } as never)

      await runScanWithTimers(1)

      expect(logger.warn).toHaveBeenCalledWith(
        'Zombie process persists after cleanup attempt',
        expect.objectContaining({ pid: 100 }),
      )

      killSpy.mockRestore()
    })

    it('handles cleanup error gracefully', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH')
      })

      mockExec
        .mockResolvedValueOnce({ stdout: '  100  200  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '200\n', stderr: '' } as never) // parent exists

      // kill throws immediately, no setTimeout reached
      await zombieDetector.scan()

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup zombie process',
        expect.objectContaining({ zombie: 100, error: expect.any(Error) }),
      )

      killSpy.mockRestore()
    })
  })

  describe('history', () => {
    it('stores zombie history', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  100  1  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '1\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      await runScanWithTimers(1)

      const history = zombieDetector.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0].pid).toBe(100)

      killSpy.mockRestore()
    })

    it('returns a copy of history (not reference)', () => {
      const h1 = zombieDetector.getHistory()
      const h2 = zombieDetector.getHistory()
      expect(h1).not.toBe(h2)
    })

    it('clears history', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      mockExec
        .mockResolvedValueOnce({ stdout: '  100  1  test  Z\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '1\n', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)

      await runScanWithTimers(1)
      expect(zombieDetector.getHistory()).toHaveLength(1)

      zombieDetector.clearHistory()
      expect(zombieDetector.getHistory()).toHaveLength(0)

      killSpy.mockRestore()
    })

    it('trims history to maxHistory', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      // Scan 55 times, each with a single zombie
      for (let i = 0; i < 55; i++) {
        // For parent-not-found path (no setTimeout delay, faster)
        mockExec
          .mockResolvedValueOnce({ stdout: `  ${100 + i}  1  test  Z\n`, stderr: '' } as never)
          .mockResolvedValueOnce({ stdout: '', stderr: '' } as never) // parent doesn't exist

        await zombieDetector.scan() // no timer advance needed for parent-not-found path
      }

      // maxZombieHistory is 50
      expect(zombieDetector.getHistory().length).toBeLessThanOrEqual(50)

      killSpy.mockRestore()
    })
  })

  describe('getCount', () => {
    it('delegates to processRegistry.getZombies()', () => {
      vi.mocked(processRegistry.getZombies).mockReturnValue([
        { pid: 1, command: 'a', args: [], source: 'exec', status: 'zombie', startTime: 0 },
        { pid: 2, command: 'b', args: [], source: 'exec', status: 'zombie', startTime: 0 },
      ] as never)

      expect(zombieDetector.getCount()).toBe(2)
    })
  })

  describe('setEnabled', () => {
    it('enables detection', () => {
      zombieDetector.setEnabled(false)
      expect(zombieDetector.isEnabled()).toBe(false)

      // setEnabled(true) also starts, so stop after
      zombieDetector.setEnabled(true)
      expect(zombieDetector.isEnabled()).toBe(true)
      zombieDetector.stop()
    })

    it('stops detector when disabled while running', () => {
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(true)

      zombieDetector.setEnabled(false)
      expect(zombieDetector.isRunning()).toBe(false)
    })

    it('starts detector when enabled and not running', () => {
      zombieDetector.setEnabled(false)
      zombieDetector.setEnabled(true)
      expect(zombieDetector.isRunning()).toBe(true)
      zombieDetector.stop()
    })
  })

  describe('isEnabled / isRunning', () => {
    it('reports enabled state', () => {
      expect(zombieDetector.isEnabled()).toBe(true)
      zombieDetector.setEnabled(false)
      expect(zombieDetector.isEnabled()).toBe(false)
    })

    it('reports running state', () => {
      expect(zombieDetector.isRunning()).toBe(false)
      zombieDetector.start()
      expect(zombieDetector.isRunning()).toBe(true)
      zombieDetector.stop()
      expect(zombieDetector.isRunning()).toBe(false)
    })
  })
})

describe('convenience functions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    zombieDetector.stop()
    zombieDetector.clearHistory()
    zombieDetector.setEnabled(false)
    zombieDetector.setEnabled(true)
    zombieDetector.stop()
    vi.clearAllMocks()

    delete process.env.VERCEL
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
  })

  afterEach(() => {
    zombieDetector.stop()
    vi.useRealTimers()
  })

  it('startZombieDetection starts the detector', () => {
    startZombieDetection()
    expect(zombieDetector.isRunning()).toBe(true)
  })

  it('stopZombieDetection stops the detector', () => {
    startZombieDetection()
    stopZombieDetection()
    expect(zombieDetector.isRunning()).toBe(false)
  })

  it('scanForZombies delegates to zombieDetector.scan', async () => {
    vi.mocked(exec).mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
    const result = await scanForZombies()
    expect(result).toEqual([])
  })

  it('getZombieHistory delegates to zombieDetector.getHistory', () => {
    const history = getZombieHistory()
    expect(history).toEqual([])
  })

  it('getZombieCount delegates to zombieDetector.getCount', () => {
    vi.mocked(processRegistry.getZombies).mockReturnValue([])
    expect(getZombieCount()).toBe(0)
  })

  it('onZombieDetected registers callback', () => {
    const cb = vi.fn()
    onZombieDetected(cb)
    // Verify no error thrown; callback is registered internally
  })
})
