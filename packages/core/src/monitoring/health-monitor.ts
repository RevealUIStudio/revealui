/**
 * Health Monitor
 *
 * Collects and aggregates system health metrics including process stats,
 * database pools, memory/CPU usage, and active alerts.
 */

import os from 'os'
import { processRegistry } from './process-registry'
import { zombieDetector } from './zombie-detector'
import type { HealthMetrics, PoolMetrics, Alert, AlertMetric, AlertLevel } from './types'
import { DEFAULT_MONITORING_CONFIG } from './types'

/**
 * Get current system health metrics
 */
export function getHealthMetrics(
  databasePools?: { rest: PoolMetrics[]; vector: PoolMetrics[] }
): HealthMetrics {
  const stats = processRegistry.getStats()
  const spawnRate = processRegistry.getSpawnRate()
  const zombies = zombieDetector.getHistory()

  // System metrics
  const memUsage = process.memoryUsage()
  const memoryUsageMB = Math.round(memUsage.rss / 1024 / 1024)
  const cpuUsage = process.cpuUsage()
  const uptimeSeconds = Math.floor(process.uptime())

  // Generate alerts
  const alerts = generateAlerts(stats, spawnRate, memoryUsageMB, databasePools)

  return {
    system: {
      memoryUsage: memoryUsageMB,
      cpuUsage: calculateCPUPercentage(cpuUsage),
      uptime: uptimeSeconds,
      platform: os.platform(),
      nodeVersion: process.version,
    },
    processes: {
      active: stats.running,
      zombies: stats.zombies,
      failed: stats.failed,
      spawnRate,
      bySource: stats.bySource,
    },
    database: databasePools || {
      rest: [],
      vector: [],
    },
    recentZombies: zombies.slice(0, 10), // Last 10 zombies
    alerts,
    timestamp: Date.now(),
  }
}

/**
 * Calculate CPU usage percentage
 */
function calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
  // This is approximate - for better accuracy, would need to track over time
  const totalMicroseconds = cpuUsage.user + cpuUsage.system
  const uptimeMicroseconds = process.uptime() * 1_000_000
  const percentage = (totalMicroseconds / uptimeMicroseconds) * 100

  return Math.round(percentage * 100) / 100 // Round to 2 decimal places
}

/**
 * Generate alerts based on current metrics and thresholds
 */
function generateAlerts(
  stats: ReturnType<typeof processRegistry.getStats>,
  spawnRate: number,
  memoryUsageMB: number,
  databasePools?: { rest: PoolMetrics[]; vector: PoolMetrics[] }
): Alert[] {
  const alerts: Alert[] = []
  const thresholds = DEFAULT_MONITORING_CONFIG.alertThresholds
  const now = Date.now()

  // Check zombie processes
  if (stats.zombies >= thresholds.zombies.critical) {
    alerts.push(createAlert('critical', 'zombies', stats.zombies, thresholds.zombies.critical, now))
  } else if (stats.zombies >= thresholds.zombies.warning) {
    alerts.push(createAlert('warning', 'zombies', stats.zombies, thresholds.zombies.warning, now))
  }

  // Check memory usage
  if (memoryUsageMB >= thresholds.memory.critical) {
    alerts.push(createAlert('critical', 'memory', memoryUsageMB, thresholds.memory.critical, now))
  } else if (memoryUsageMB >= thresholds.memory.warning) {
    alerts.push(createAlert('warning', 'memory', memoryUsageMB, thresholds.memory.warning, now))
  }

  // Check active processes
  if (stats.running >= thresholds.processes.active.critical) {
    alerts.push(
      createAlert(
        'critical',
        'active_processes',
        stats.running,
        thresholds.processes.active.critical,
        now
      )
    )
  } else if (stats.running >= thresholds.processes.active.warning) {
    alerts.push(
      createAlert(
        'warning',
        'active_processes',
        stats.running,
        thresholds.processes.active.warning,
        now
      )
    )
  }

  // Check spawn rate
  if (spawnRate >= thresholds.spawnRate.critical) {
    alerts.push(
      createAlert('critical', 'spawn_rate', spawnRate, thresholds.spawnRate.critical, now)
    )
  } else if (spawnRate >= thresholds.spawnRate.warning) {
    alerts.push(createAlert('warning', 'spawn_rate', spawnRate, thresholds.spawnRate.warning, now))
  }

  // Check database waiting connections
  if (databasePools) {
    const allPools = [...databasePools.rest, ...databasePools.vector]
    const totalWaiting = allPools.reduce((sum, pool) => sum + pool.waitingCount, 0)

    if (totalWaiting >= thresholds.database.waiting.critical) {
      alerts.push(
        createAlert(
          'critical',
          'database_waiting',
          totalWaiting,
          thresholds.database.waiting.critical,
          now
        )
      )
    } else if (totalWaiting >= thresholds.database.waiting.warning) {
      alerts.push(
        createAlert(
          'warning',
          'database_waiting',
          totalWaiting,
          thresholds.database.waiting.warning,
          now
        )
      )
    }
  }

  return alerts
}

/**
 * Create an alert object
 */
function createAlert(
  level: AlertLevel,
  metric: AlertMetric,
  value: number,
  threshold: number,
  timestamp: number
): Alert {
  const messages: Record<AlertMetric, (value: number, threshold: number) => string> = {
    zombies: (v, t) => `${v} zombie processes detected (threshold: ${t})`,
    memory: (v, t) => `Memory usage at ${v}MB (threshold: ${t}MB)`,
    active_processes: (v, t) => `${v} active processes (threshold: ${t})`,
    database_waiting: (v, t) => `${v} database connections waiting (threshold: ${t})`,
    spawn_rate: (v, t) => `Process spawn rate at ${v}/min (threshold: ${t}/min)`,
  }

  return {
    level,
    metric,
    message: messages[metric](value, threshold),
    value,
    threshold,
    timestamp,
  }
}

/**
 * Get health status based on alerts
 */
export function getHealthStatus(
  alerts: Alert[]
): { status: 'healthy' | 'degraded' | 'unhealthy'; statusCode: number } {
  const hasCritical = alerts.some((a) => a.level === 'critical')
  const hasWarning = alerts.some((a) => a.level === 'warning')

  if (hasCritical) {
    return { status: 'unhealthy', statusCode: 503 }
  } else if (hasWarning) {
    return { status: 'degraded', statusCode: 206 }
  } else {
    return { status: 'healthy', statusCode: 200 }
  }
}
