/**
 * Process Tracker Wrapper for Development Workflow
 *
 * Provides utilities for tracking processes in development environment
 * with integration to the monitoring system.
 */

import {
  getHealthMetrics,
  getProcessStats,
  onZombieDetected,
  startZombieDetection,
  stopZombieDetection,
  type ZombieProcess,
} from '@revealui/core/monitoring'
import { createLogger } from '../logger.js'

const logger = createLogger({ prefix: 'Monitor' })

/**
 * Start development monitoring
 */
export function startDevMonitoring(): void {
  logger.info('Starting development monitoring')

  // Start zombie detection
  startZombieDetection()

  // Set up zombie detection callback
  onZombieDetected((zombie: ZombieProcess) => {
    logger.warn(`Zombie process detected: PID ${zombie.pid} (${zombie.command})`, {
      ppid: zombie.ppid,
      detectedAt: new Date(zombie.detectedAt).toISOString(),
    })
  })

  // Log initial stats
  const stats = getProcessStats()
  logger.info('Process monitoring enabled', {
    totalProcesses: stats.total,
    activeProcesses: stats.running,
  })
}

/**
 * Stop development monitoring
 */
export function stopDevMonitoring(): void {
  logger.info('Stopping development monitoring')
  stopZombieDetection()
}

/**
 * Get current monitoring status for display
 */
export function getMonitoringStatus(): {
  processes: {
    total: number
    running: number
    failed: number
    zombies: number
  }
  spawnRate: number
  alerts: number
} {
  const stats = getProcessStats()
  const metrics = getHealthMetrics()

  return {
    processes: {
      total: stats.total,
      running: stats.running,
      failed: stats.failed,
      zombies: stats.zombies,
    },
    spawnRate: metrics.processes.spawnRate,
    alerts: metrics.alerts.length,
  }
}

/**
 * Log monitoring status to console
 */
export function logMonitoringStatus(): void {
  const status = getMonitoringStatus()

  logger.info('Monitoring Status:', {
    processes: `${status.processes.running} running, ${status.processes.failed} failed, ${status.processes.zombies} zombies`,
    spawnRate: `${status.spawnRate}/min`,
    alerts: status.alerts > 0 ? `${status.alerts} active` : 'none',
  })
}

/**
 * Start periodic monitoring status logging
 */
export function startPeriodicStatusLogging(intervalMs = 60000): NodeJS.Timeout {
  logger.info(`Starting periodic status logging (every ${intervalMs / 1000}s)`)

  const interval = setInterval(() => {
    logMonitoringStatus()
  }, intervalMs)

  // Don't keep process alive
  interval.unref()

  return interval
}

/**
 * Stop periodic monitoring status logging
 */
export function stopPeriodicStatusLogging(interval: NodeJS.Timeout): void {
  clearInterval(interval)
}

/**
 * Display monitoring summary on exit
 */
export function displayMonitoringSummary(): void {
  const stats = getProcessStats()

  logger.header('Development Session Summary')
  logger.info(`Total processes spawned: ${stats.total}`)
  logger.info(`Completed: ${stats.completed}`)
  logger.info(`Failed: ${stats.failed}`)
  logger.info(`Zombies detected: ${stats.zombies}`)
  logger.info(`Killed: ${stats.killed}`)

  // Log by source
  logger.info('By source:')
  for (const [source, count] of Object.entries(stats.bySource)) {
    if (count > 0) {
      logger.info(`  ${source}: ${count}`)
    }
  }

  // Show warnings if any issues
  if (stats.failed > 0) {
    logger.warn(`⚠️  ${stats.failed} processes failed during this session`)
  }
  if (stats.zombies > 0) {
    logger.warn(`⚠️  ${stats.zombies} zombie processes detected during this session`)
  }
}
