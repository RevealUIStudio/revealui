/**
 * Tests for RollbackManager
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock problematic imports
vi.mock('@revealui/core/monitoring', () => ({
  registerProcess: vi.fn(),
  updateProcessStatus: vi.fn(),
}))

vi.mock('../../../lib/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { RollbackManager } from '../../../lib/rollback/manager.js'

describe('RollbackManager', () => {
  const testDir = join(process.cwd(), '.test-rollback')
  let manager: RollbackManager

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    manager = new RollbackManager(testDir)
  })

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('createCheckpoint', () => {
    it('should create a checkpoint with metadata', async () => {
      const checkpointId = await manager.createCheckpoint('database', {
        description: 'Test checkpoint',
        data: { test: 'data' },
      })

      expect(checkpointId).toBeTruthy()
      expect(checkpointId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)

      const checkpoint = await manager.getCheckpoint(checkpointId)
      expect(checkpoint).toBeTruthy()
      expect(checkpoint?.type).toBe('database')
      expect(checkpoint?.description).toBe('Test checkpoint')
      expect(checkpoint?.data).toEqual({ test: 'data' })
    })

    it('should support all checkpoint types', async () => {
      const types = ['database', 'file', 'configuration', 'schema', 'custom'] as const

      for (const type of types) {
        const checkpointId = await manager.createCheckpoint(type, {
          description: `Test ${type}`,
        })

        const checkpoint = await manager.getCheckpoint(checkpointId)
        expect(checkpoint?.type).toBe(type)
      }
    })

    it('should store checkpoint to filesystem', async () => {
      const checkpointId = await manager.createCheckpoint('database', {
        description: 'Test',
      })

      const checkpointPath = join(testDir, '.rollback', `${checkpointId}.json`)
      expect(existsSync(checkpointPath)).toBe(true)
    })
  })

  describe('listCheckpoints', () => {
    it('should return empty array when no checkpoints', async () => {
      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toEqual([])
    })

    it('should list all checkpoints', async () => {
      await manager.createCheckpoint('database', { description: 'Test 1' })
      await manager.createCheckpoint('file', { description: 'Test 2' })
      await manager.createCheckpoint('configuration', { description: 'Test 3' })

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toHaveLength(3)
    })

    it('should sort checkpoints by creation time (newest first)', async () => {
      const id1 = await manager.createCheckpoint('database', { description: 'First' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const id2 = await manager.createCheckpoint('database', { description: 'Second' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const id3 = await manager.createCheckpoint('database', { description: 'Third' })

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints[0].id).toBe(id3)
      expect(checkpoints[1].id).toBe(id2)
      expect(checkpoints[2].id).toBe(id1)
    })
  })

  describe('getLatestCheckpoint', () => {
    it('should return null when no checkpoints', async () => {
      const latest = await manager.getLatestCheckpoint()
      expect(latest).toBeNull()
    })

    it('should return latest checkpoint', async () => {
      await manager.createCheckpoint('database', { description: 'First' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const id2 = await manager.createCheckpoint('database', { description: 'Second' })

      const latest = await manager.getLatestCheckpoint()
      expect(latest?.id).toBe(id2)
      expect(latest?.description).toBe('Second')
    })

    it('should filter by checkpoint type', async () => {
      await manager.createCheckpoint('database', { description: 'DB 1' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const fileId = await manager.createCheckpoint('file', { description: 'File 1' })
      await new Promise((resolve) => setTimeout(resolve, 100))
      await manager.createCheckpoint('database', { description: 'DB 2' })

      const latest = await manager.getLatestCheckpoint('file')
      expect(latest?.id).toBe(fileId)
      expect(latest?.type).toBe('file')
    })
  })

  describe('rollback', () => {
    it('should restore checkpoint data', async () => {
      const testData = { value: 'original', count: 42 }
      const checkpointId = await manager.createCheckpoint('custom', {
        description: 'Test restore',
        data: testData,
      })

      const result = await manager.rollback(checkpointId)
      expect(result.success).toBe(true)
      expect(result.checkpointId).toBe(checkpointId)
      expect(result.data).toEqual(testData)
    })

    it('should support dry-run mode', async () => {
      const checkpointId = await manager.createCheckpoint('custom', {
        description: 'Test',
        data: { value: 'test' },
      })

      const result = await manager.rollback(checkpointId, { dryRun: true })
      expect(result.success).toBe(true)
      expect(result.dryRun).toBe(true)
    })

    it('should fail for non-existent checkpoint', async () => {
      const result = await manager.rollback('non-existent-id')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('rollbackLast', () => {
    it('should rollback to last checkpoint', async () => {
      await manager.createCheckpoint('database', { description: 'First', data: { value: 1 } })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const id2 = await manager.createCheckpoint('database', {
        description: 'Second',
        data: { value: 2 },
      })

      const result = await manager.rollbackLast()
      expect(result.success).toBe(true)
      expect(result.checkpointId).toBe(id2)
      expect(result.data).toEqual({ value: 2 })
    })

    it('should filter by type when rolling back last', async () => {
      // Use longer retention to prevent any cleanup interference
      const testManager = new RollbackManager(testDir, 365)

      await testManager.createCheckpoint('database', { description: 'DB', data: { db: true } })
      await new Promise((resolve) => setTimeout(resolve, 100))
      const fileId = await testManager.createCheckpoint('file', {
        description: 'File',
        data: { file: true },
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      await testManager.createCheckpoint('database', { description: 'DB 2', data: { db: false } })

      const result = await testManager.rollbackLast('file')
      expect(result.success).toBe(true)
      expect(result.checkpointId).toBe(fileId)
      expect(result.data).toEqual({ file: true })
    })

    it('should fail when no checkpoints exist', async () => {
      const result = await manager.rollbackLast()
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('cleanupOldCheckpoints', () => {
    it('should delete checkpoints older than 7 days', async () => {
      // Use longer retention to prevent automatic cleanup during test
      const testManager = new RollbackManager(testDir, 365) // 365 days retention

      // Create old checkpoint by modifying timestamp
      const oldId = await testManager.createCheckpoint('database', {
        description: 'Old checkpoint',
        data: { old: true },
      })

      // Manipulate checkpoint file timestamp
      const checkpointPath = join(testDir, '.rollback', `${oldId}.json`)
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'))
      checkpoint.createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))

      // Create recent checkpoint
      await testManager.createCheckpoint('database', {
        description: 'Recent',
        data: { recent: true },
      })

      // Now test cleanup with standard 7-day retention
      const cleanupManager = new RollbackManager(testDir, 7)
      const deleted = await cleanupManager.cleanupOldCheckpoints()
      expect(deleted).toBe(1)

      const remaining = await cleanupManager.listCheckpoints()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].description).toBe('Recent')
    })

    it('should not delete recent checkpoints', async () => {
      await manager.createCheckpoint('database', { description: 'Test 1' })
      await manager.createCheckpoint('database', { description: 'Test 2' })

      const deleted = await manager.cleanupOldCheckpoints()
      expect(deleted).toBe(0)

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toHaveLength(2)
    })
  })

  describe('clearAllCheckpoints', () => {
    it('should require confirmation flag', async () => {
      await manager.createCheckpoint('database', { description: 'Test' })

      const deleted = await manager.clearAllCheckpoints(false)
      expect(deleted).toBe(0)

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toHaveLength(1)
    })

    it('should delete all checkpoints when confirmed', async () => {
      await manager.createCheckpoint('database', { description: 'Test 1' })
      await manager.createCheckpoint('file', { description: 'Test 2' })
      await manager.createCheckpoint('configuration', { description: 'Test 3' })

      const deleted = await manager.clearAllCheckpoints(true)
      expect(deleted).toBe(3)

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle concurrent checkpoint creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.createCheckpoint('database', { description: `Concurrent ${i}` }),
      )

      const ids = await Promise.all(promises)
      expect(new Set(ids).size).toBe(5) // All IDs should be unique

      const checkpoints = await manager.listCheckpoints()
      expect(checkpoints).toHaveLength(5)
    })

    it('should handle large checkpoint data', async () => {
      const largeData = {
        records: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `test-${i}`,
          nested: { deep: { data: `value-${i}` } },
        })),
      }

      const checkpointId = await manager.createCheckpoint('database', {
        description: 'Large data',
        data: largeData,
      })

      const checkpoint = await manager.getCheckpoint(checkpointId)
      expect(checkpoint?.data).toEqual(largeData)
    })

    it('should handle checkpoints with special characters in description', async () => {
      const description = 'Test with "quotes", <tags>, and 特殊字符'
      const checkpointId = await manager.createCheckpoint('database', {
        description,
      })

      const checkpoint = await manager.getCheckpoint(checkpointId)
      expect(checkpoint?.description).toBe(description)
    })
  })
})
