/**
 * Script Health Monitor
 *
 * Monitors script health based on execution history, tracks trends,
 * and provides health dashboards and alerts.
 *
 * @dependencies
 * - scripts/lib/audit/execution-logger.ts - Execution history retrieval
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for validation
 * - @electric-sql/pglite - Embedded PostgreSQL for health metrics storage
 * - node:fs/promises - File system operations for database directory
 * - node:path - Path manipulation utilities
 *
 * @example
 * ```typescript
 * const monitor = await getHealthMonitor()
 *
 * // Get current health
 * const health = await monitor.getHealth('db')
 *
 * // Get health history
 * const history = await monitor.getHealthHistory('db', { days: 7 })
 *
 * // Get dashboard
 * const dashboard = await monitor.getDashboard()
 * ```
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { getExecutionLogger } from '../audit/execution-logger.js'
import { ErrorCode, ScriptError } from '../errors.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Health status
 */
export interface HealthStatus {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'

  /** Health score (0-100) */
  score: number

  /** Success rate (0-1) */
  successRate: number

  /** Trend (improving, stable, degrading) */
  trend: 'improving' | 'stable' | 'degrading'

  /** Last execution timestamp */
  lastExecution: Date | null

  /** Recent failures count */
  recentFailures: number

  /** Average execution time (ms) */
  avgExecutionTimeMs: number
}

/**
 * Health alert
 */
export interface HealthAlert {
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical'

  /** Alert message */
  message: string

  /** Script name */
  scriptName: string

  /** Alert timestamp */
  timestamp: Date

  /** Related metrics */
  metrics: Record<string, unknown>
}

/**
 * Health snapshot
 */
export interface HealthSnapshot {
  /** Script name */
  scriptName: string

  /** Snapshot timestamp */
  timestamp: Date

  /** Health status at this point */
  status: HealthStatus

  /** Active alerts */
  alerts: HealthAlert[]
}

/**
 * Health dashboard
 */
export interface HealthDashboard {
  /** Overall system health */
  overall: HealthStatus

  /** Per-script health */
  scripts: Array<{
    scriptName: string
    status: HealthStatus
    alerts: HealthAlert[]
  }>

  /** System-wide alerts */
  systemAlerts: HealthAlert[]

  /** Generated at */
  timestamp: Date
}

// =============================================================================
// Script Health Monitor Class
// =============================================================================

export class ScriptHealthMonitor {
  private static instance: ScriptHealthMonitor | null = null
  private db: PGlite | null = null
  private dbPath: string

  private constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  /**
   * Get singleton instance
   */
  static async getInstance(projectRoot?: string): Promise<ScriptHealthMonitor> {
    if (!ScriptHealthMonitor.instance) {
      const root = projectRoot || process.cwd()
      const dbPath = join(root, '.revealui', 'script-management.db')
      ScriptHealthMonitor.instance = new ScriptHealthMonitor(dbPath)
      await ScriptHealthMonitor.instance.initialize()
    }

    return ScriptHealthMonitor.instance
  }

  /**
   * Initialize database and create schema
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(join(this.dbPath, '..'), { recursive: true })

      // Initialize PGlite
      this.db = new PGlite(this.dbPath)

      // Create schema
      await this.createSchema()
    } catch (error) {
      console.error('Failed to initialize health monitor:', error)
      throw error
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE)

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS health_snapshots (
        id SERIAL PRIMARY KEY,
        script_name TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        status TEXT NOT NULL,
        score INTEGER NOT NULL,
        success_rate REAL NOT NULL,
        trend TEXT NOT NULL,
        recent_failures INTEGER NOT NULL,
        avg_execution_time_ms INTEGER NOT NULL,
        alerts JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_health_script_name ON health_snapshots(script_name);
      CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_snapshots(timestamp);
    `)
  }

  /**
   * Get current health status for a script
   */
  async getHealth(scriptName: string): Promise<HealthStatus> {
    const logger = await getExecutionLogger()

    // Get execution history (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const executions = await logger.getHistory({
      scriptName,
      startDate: thirtyDaysAgo,
      limit: 100,
    })

    if (executions.length === 0) {
      return {
        status: 'healthy',
        score: 100,
        successRate: 1,
        trend: 'stable',
        lastExecution: null,
        recentFailures: 0,
        avgExecutionTimeMs: 0,
      }
    }

    // Calculate metrics
    const successCount = executions.filter((e) => e.success).length
    const successRate = successCount / executions.length

    // Recent failures (last 10 executions)
    const recent = executions.slice(0, 10)
    const recentFailures = recent.filter((e) => !e.success).length

    // Average execution time (rounded to integer for database storage)
    const avgExecutionTimeMs = Math.round(
      executions
        .filter((e) => e.durationMs !== null)
        .reduce((sum, e) => sum + (e.durationMs || 0), 0) / executions.length,
    )

    // Calculate trend (compare first half vs second half)
    const halfPoint = Math.floor(executions.length / 2)
    const oldHalf = executions.slice(halfPoint)
    const newHalf = executions.slice(0, halfPoint)

    const oldSuccessRate = oldHalf.filter((e) => e.success).length / oldHalf.length
    const newSuccessRate = newHalf.filter((e) => e.success).length / newHalf.length

    let trend: 'improving' | 'stable' | 'degrading'
    if (newSuccessRate > oldSuccessRate + 0.1) trend = 'improving'
    else if (newSuccessRate < oldSuccessRate - 0.1) trend = 'degrading'
    else trend = 'stable'

    // Calculate health score
    const score = this.calculateHealthScore(successRate, recentFailures, trend)

    // Determine status
    let status: HealthStatus['status']
    if (score >= 90) status = 'healthy'
    else if (score >= 70) status = 'degraded'
    else if (score >= 50) status = 'unhealthy'
    else status = 'critical'

    return {
      status,
      score,
      successRate,
      trend,
      lastExecution: executions[0].startedAt,
      recentFailures,
      avgExecutionTimeMs,
    }
  }

  /**
   * Get health history for a script
   */
  async getHealthHistory(
    scriptName: string,
    options: { days?: number; limit?: number } = {},
  ): Promise<HealthSnapshot[]> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE)

    const { days = 7, limit = 50 } = options
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

    const result = await this.db.query<{
      // biome-ignore lint/style/useNamingConvention: Database column name
      script_name: string
      timestamp: string
      status: string
      score: number
      // biome-ignore lint/style/useNamingConvention: Database column name
      success_rate: number
      trend: string
      // biome-ignore lint/style/useNamingConvention: Database column name
      recent_failures: number
      // biome-ignore lint/style/useNamingConvention: Database column name
      avg_execution_time_ms: number
      alerts: string
    }>(
      `SELECT * FROM health_snapshots
       WHERE script_name = $1 AND timestamp >= $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [scriptName, cutoffTime, limit],
    )

    return result.rows.map((row) => ({
      scriptName: row.script_name,
      timestamp: new Date(Number(row.timestamp)),
      status: {
        status: row.status as HealthStatus['status'],
        score: Number(row.score),
        successRate: Number(row.success_rate),
        trend: row.trend as HealthStatus['trend'],
        lastExecution: null, // Not stored in snapshots
        recentFailures: Number(row.recent_failures),
        avgExecutionTimeMs: Number(row.avg_execution_time_ms),
      },
      alerts: JSON.parse(row.alerts) as HealthAlert[],
    }))
  }

  /**
   * Get comprehensive health dashboard
   */
  async getDashboard(): Promise<HealthDashboard> {
    const logger = await getExecutionLogger()

    // Get all unique script names from execution history
    const stats = await logger.getStats({ days: 30 })
    const scriptNames = [...new Set(stats.topScripts.map((s) => s.scriptName))]

    // Get health for each script
    const scriptHealth = await Promise.all(
      scriptNames.map(async (scriptName) => {
        const status = await this.getHealth(scriptName)
        const alerts = await this.generateAlerts(scriptName, status)

        // Store snapshot
        await this.storeSnapshot(scriptName, status, alerts)

        return {
          scriptName,
          status,
          alerts,
        }
      }),
    )

    // Calculate overall health
    const overallScore =
      scriptHealth.length > 0
        ? scriptHealth.reduce((sum, s) => sum + s.status.score, 0) / scriptHealth.length
        : 100

    const overallSuccessRate =
      scriptHealth.length > 0
        ? scriptHealth.reduce((sum, s) => sum + s.status.successRate, 0) / scriptHealth.length
        : 1

    let overallStatus: HealthStatus['status']
    if (overallScore >= 90) overallStatus = 'healthy'
    else if (overallScore >= 70) overallStatus = 'degraded'
    else if (overallScore >= 50) overallStatus = 'unhealthy'
    else overallStatus = 'critical'

    const overall: HealthStatus = {
      status: overallStatus,
      score: Math.round(overallScore),
      successRate: overallSuccessRate,
      trend: 'stable', // Would need historical comparison
      lastExecution: null,
      recentFailures: scriptHealth.reduce((sum, s) => sum + s.status.recentFailures, 0),
      avgExecutionTimeMs: Math.round(
        scriptHealth.length > 0
          ? scriptHealth.reduce((sum, s) => sum + s.status.avgExecutionTimeMs, 0) /
              scriptHealth.length
          : 0,
      ),
    }

    // Collect system-wide alerts
    const systemAlerts: HealthAlert[] = []
    if (overallStatus === 'critical') {
      systemAlerts.push({
        severity: 'critical',
        message: 'System health is critical - multiple scripts failing',
        scriptName: 'system',
        timestamp: new Date(),
        metrics: {
          overallScore,
          affectedScripts: scriptHealth.filter((s) => s.status.status === 'critical').length,
        },
      })
    }

    return {
      overall,
      scripts: scriptHealth,
      systemAlerts,
      timestamp: new Date(),
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Calculate health score
   */
  private calculateHealthScore(
    successRate: number,
    recentFailures: number,
    trend: HealthStatus['trend'],
  ): number {
    let score = successRate * 100

    // Penalize recent failures
    score -= recentFailures * 5

    // Adjust for trend
    if (trend === 'improving') score += 5
    else if (trend === 'degrading') score -= 10

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Generate alerts based on health status
   */
  private async generateAlerts(scriptName: string, status: HealthStatus): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = []

    if (status.status === 'critical') {
      alerts.push({
        severity: 'critical',
        message: `Script "${scriptName}" is in critical state`,
        scriptName,
        timestamp: new Date(),
        metrics: {
          score: status.score,
          successRate: status.successRate,
          recentFailures: status.recentFailures,
        },
      })
    } else if (status.status === 'unhealthy') {
      alerts.push({
        severity: 'warning',
        message: `Script "${scriptName}" health is degraded`,
        scriptName,
        timestamp: new Date(),
        metrics: {
          score: status.score,
          successRate: status.successRate,
        },
      })
    }

    if (status.trend === 'degrading') {
      alerts.push({
        severity: 'warning',
        message: `Script "${scriptName}" showing degrading trend`,
        scriptName,
        timestamp: new Date(),
        metrics: { trend: status.trend },
      })
    }

    if (status.recentFailures >= 3) {
      alerts.push({
        severity: 'warning',
        message: `Script "${scriptName}" has ${status.recentFailures} recent failures`,
        scriptName,
        timestamp: new Date(),
        metrics: { recentFailures: status.recentFailures },
      })
    }

    return alerts
  }

  /**
   * Store health snapshot
   */
  private async storeSnapshot(
    scriptName: string,
    status: HealthStatus,
    alerts: HealthAlert[],
  ): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE)

    await this.db.query(
      `
        INSERT INTO health_snapshots (
          script_name, timestamp, status, score, success_rate,
          trend, recent_failures, avg_execution_time_ms, alerts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        scriptName,
        Date.now(),
        status.status,
        status.score,
        status.successRate,
        status.trend,
        status.recentFailures,
        status.avgExecutionTimeMs,
        JSON.stringify(alerts),
      ],
    )
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get health monitor instance
 */
export async function getHealthMonitor(projectRoot?: string): Promise<ScriptHealthMonitor> {
  return ScriptHealthMonitor.getInstance(projectRoot)
}
