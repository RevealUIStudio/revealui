/**
 * Process Registry Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { processRegistry } from '../process-registry.js'

describe('ProcessRegistry', () => {
  beforeEach(() => {
    processRegistry.clear()
  })

  describe('register', () => {
    it('should register a new process', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec')

      const process = processRegistry.get(1234)
      expect(process).toBeDefined()
      expect(process?.pid).toBe(1234)
      expect(process?.command).toBe('node')
      expect(process?.args).toEqual(['test.js'])
      expect(process?.source).toBe('exec')
      expect(process?.status).toBe('running')
    })

    it('should register process with metadata', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec', { taskId: 'task-1' }, 5678)

      const process = processRegistry.get(1234)
      expect(process?.metadata).toEqual({ taskId: 'task-1' })
      expect(process?.ppid).toBe(5678)
    })
  })

  describe('updateStatus', () => {
    it('should update process status', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec')
      processRegistry.updateStatus(1234, 'completed', 0)

      const process = processRegistry.get(1234)
      expect(process?.status).toBe('completed')
      expect(process?.exitCode).toBe(0)
      expect(process?.endTime).toBeDefined()
    })

    it('should update status with signal', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec')
      processRegistry.updateStatus(1234, 'killed', undefined, 'SIGTERM')

      const process = processRegistry.get(1234)
      expect(process?.status).toBe('killed')
      expect(process?.signal).toBe('SIGTERM')
    })
  })

  describe('markZombie', () => {
    it('should mark process as zombie', () => {
      processRegistry.register(1234, 'node', ['test.js'], 'exec')
      processRegistry.markZombie(1234)

      const process = processRegistry.get(1234)
      expect(process?.status).toBe('zombie')
    })
  })

  describe('getByStatus', () => {
    it('should return processes by status', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')
      processRegistry.updateStatus(1234, 'completed', 0)

      const running = processRegistry.getByStatus('running')
      const completed = processRegistry.getByStatus('completed')

      expect(running).toHaveLength(1)
      expect(running[0].pid).toBe(5678)
      expect(completed).toHaveLength(1)
      expect(completed[0].pid).toBe(1234)
    })
  })

  describe('getBySource', () => {
    it('should return processes by source', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'mcp', ['server'], 'mcp')

      const execProcesses = processRegistry.getBySource('exec')
      const mcpProcesses = processRegistry.getBySource('mcp')

      expect(execProcesses).toHaveLength(1)
      expect(execProcesses[0].pid).toBe(1234)
      expect(mcpProcesses).toHaveLength(1)
      expect(mcpProcesses[0].pid).toBe(5678)
    })
  })

  describe('getStats', () => {
    it('should return registry statistics', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')
      processRegistry.register(9012, 'mcp', ['server'], 'mcp')
      processRegistry.updateStatus(1234, 'completed', 0)
      processRegistry.markZombie(9012)

      const stats = processRegistry.getStats()

      expect(stats.total).toBe(3)
      expect(stats.running).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.zombies).toBe(1)
      expect(stats.bySource.exec).toBe(2)
      expect(stats.bySource.mcp).toBe(1)
    })
  })

  describe('getSpawnRate', () => {
    it('should calculate spawn rate', () => {
      const now = Date.now()

      // Mock process start times
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')

      // Manually set start times for testing
      const p1 = processRegistry.get(1234)
      const p2 = processRegistry.get(5678)
      if (p1) p1.startTime = now - 30000 // 30 seconds ago
      if (p2) p2.startTime = now - 90000 // 90 seconds ago

      const rate = processRegistry.getSpawnRate()
      expect(rate).toBe(1) // Only p1 is within last minute
    })
  })

  describe('getRunning', () => {
    it('should return only running processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')
      processRegistry.updateStatus(1234, 'completed', 0)

      const running = processRegistry.getRunning()
      expect(running).toHaveLength(1)
      expect(running[0].pid).toBe(5678)
    })
  })

  describe('getZombies', () => {
    it('should return only zombie processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')
      processRegistry.markZombie(1234)

      const zombies = processRegistry.getZombies()
      expect(zombies).toHaveLength(1)
      expect(zombies[0].pid).toBe(1234)
    })
  })

  describe('getFailed', () => {
    it('should return only failed processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')
      processRegistry.updateStatus(1234, 'failed', 1)

      const failed = processRegistry.getFailed()
      expect(failed).toHaveLength(1)
      expect(failed[0].pid).toBe(1234)
      expect(failed[0].exitCode).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear all processes', () => {
      processRegistry.register(1234, 'node', ['test1.js'], 'exec')
      processRegistry.register(5678, 'node', ['test2.js'], 'exec')

      processRegistry.clear()

      expect(processRegistry.getAll()).toHaveLength(0)
    })
  })

  describe('enabled state', () => {
    it('should respect enabled state', () => {
      processRegistry.setEnabled(false)
      processRegistry.register(1234, 'node', ['test.js'], 'exec')

      expect(processRegistry.get(1234)).toBeUndefined()

      processRegistry.setEnabled(true)
      processRegistry.register(5678, 'node', ['test.js'], 'exec')

      expect(processRegistry.get(5678)).toBeDefined()
    })
  })
})
