/**
 * Exec Monitoring Integration Tests
 */

import { getProcessStats, processRegistry } from '@revealui/core/monitoring'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execCommand } from '../exec.js'

describe('Exec Monitoring Integration', () => {
  beforeEach(() => {
    processRegistry.clear()
  })

  afterEach(() => {
    processRegistry.clear()
  })

  it('should register process on spawn', async () => {
    const initialStats = getProcessStats()
    const initialTotal = initialStats.total

    // Execute a simple command
    const promise = execCommand('echo', ['test'], { capture: true })

    // Give it a moment to spawn
    await new Promise((resolve) => setTimeout(resolve, 100))

    const afterSpawnStats = getProcessStats()

    // Should have registered the process
    expect(afterSpawnStats.total).toBeGreaterThan(initialTotal)

    await promise
  })

  it('should update process status on completion', async () => {
    // Execute a simple successful command
    const result = await execCommand('echo', ['test'], { capture: true })

    expect(result.success).toBe(true)

    // Check process registry
    const stats = getProcessStats()
    expect(stats.completed).toBeGreaterThan(0)
  })

  it('should update process status on failure', async () => {
    // Execute a command that will fail
    const result = await execCommand('false', [], { capture: true })

    expect(result.success).toBe(false)

    // Check process registry
    const stats = getProcessStats()
    expect(stats.failed).toBeGreaterThan(0)
  })

  it('should track process metadata', async () => {
    const metadata = { testId: 'test-123', type: 'integration' }

    await execCommand('echo', ['test'], {
      capture: true,
      metadata,
    })

    // Find the process with our metadata
    const allProcesses = processRegistry.getAll()
    const testProcess = allProcesses.find((p) => p.metadata?.testId === 'test-123')

    expect(testProcess).toBeDefined()
    expect(testProcess?.metadata?.type).toBe('integration')
  })

  it('should handle timeout gracefully', async () => {
    // Execute a command that will timeout (sleep longer than timeout)
    const result = await execCommand('sleep', ['10'], {
      capture: true,
      timeout: 100, // 100ms timeout
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain('timeout')
  })

  it('should track multiple processes', async () => {
    const initialStats = getProcessStats()

    // Execute multiple commands in parallel
    await Promise.all([
      execCommand('echo', ['test1'], { capture: true }),
      execCommand('echo', ['test2'], { capture: true }),
      execCommand('echo', ['test3'], { capture: true }),
    ])

    const finalStats = getProcessStats()

    // Should have tracked all processes
    expect(finalStats.total).toBeGreaterThan(initialStats.total)
  })

  it('should track processes by source', async () => {
    await execCommand('echo', ['test'], { capture: true })

    const stats = getProcessStats()

    // Should have exec processes
    expect(stats.bySource.exec).toBeGreaterThan(0)
  })

  it('should calculate spawn rate', async () => {
    // Clear registry
    processRegistry.clear()

    // Spawn several processes
    await Promise.all([
      execCommand('echo', ['1'], { capture: true }),
      execCommand('echo', ['2'], { capture: true }),
      execCommand('echo', ['3'], { capture: true }),
    ])

    const spawnRate = processRegistry.getSpawnRate()

    // Should have calculated a spawn rate
    expect(spawnRate).toBeGreaterThan(0)
  })
})
