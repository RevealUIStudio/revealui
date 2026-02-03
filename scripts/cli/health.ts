#!/usr/bin/env tsx
/**
 * Health Monitoring CLI
 *
 * Monitors script health, tracks trends, and displays health dashboards.
 *
 * Usage:
 *   pnpm health check <script>                   Check script health
 *   pnpm health dashboard                        Show full dashboard
 *   pnpm health history <script>                 Show health history
 *   pnpm health alerts [<script>]                Show active alerts
 *
 * Examples:
 *   pnpm health check db
 *   pnpm health dashboard
 *   pnpm health history db --days 7
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HealthStatus } from '../lib/monitoring/script-health.js'
import { getHealthMonitor } from '../lib/monitoring/script-health.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// Get project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * Health Monitoring CLI
 */
class HealthCLI extends BaseCLI {
  name = 'health'
  description = 'Script health monitoring and dashboard'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'check',
        description: 'Check health status of a script (usage: health check <script>)',
        handler: async () => this.check(),
        args: [],
      },
      {
        name: 'dashboard',
        description: 'Show comprehensive health dashboard',
        handler: async () => this.dashboard(),
        args: [],
      },
      {
        name: 'history',
        description: 'Show health history for a script (usage: health history <script>)',
        handler: async () => this.history(),
        args: [
          {
            name: 'days',
            short: 'd',
            type: 'number',
            description: 'Number of days to show',
          },
          {
            name: 'limit',
            short: 'l',
            type: 'number',
            description: 'Limit number of results',
          },
        ],
      },
      {
        name: 'alerts',
        description: 'Show active health alerts (usage: health alerts [script])',
        handler: async () => this.alerts(),
        args: [],
      },
    ]
  }

  /**
   * Check script health
   */
  private async check() {
    const scriptName = this.requirePositional(0, 'script')

    const monitor = await getHealthMonitor(PROJECT_ROOT)
    const health = await monitor.getHealth(scriptName)

    if (this.args.flags.json) {
      return this.output.success({ health })
    }

    console.log(`\nHealth Check: ${scriptName}\n`)
    console.log('─'.repeat(60))

    const statusColor = this.getStatusColor(health.status)
    const statusIcon = this.getStatusIcon(health.status)
    const resetColor = '\x1b[0m'

    console.log(`${statusColor}${statusIcon} Status: ${health.status.toUpperCase()}${resetColor}`)
    console.log(`  Score: ${health.score}/100`)
    console.log(`  Success Rate: ${(health.successRate * 100).toFixed(1)}%`)
    console.log(`  Trend: ${this.getTrendIcon(health.trend)} ${health.trend}`)

    if (health.lastExecution) {
      console.log(`  Last Execution: ${health.lastExecution.toLocaleString()}`)
    }

    console.log(`  Recent Failures: ${health.recentFailures}`)
    console.log(`  Avg Execution Time: ${health.avgExecutionTimeMs.toFixed(0)}ms`)

    console.log()

    return this.output.success({ health })
  }

  /**
   * Show full health dashboard
   */
  private async dashboard() {
    const monitor = await getHealthMonitor(PROJECT_ROOT)
    const dashboard = await monitor.getDashboard()

    if (this.args.flags.json) {
      return this.output.success({ dashboard })
    }

    console.log('\nHealth Dashboard\n')
    console.log('='.repeat(60))

    // Overall health
    const statusColor = this.getStatusColor(dashboard.overall.status)
    const statusIcon = this.getStatusIcon(dashboard.overall.status)
    const resetColor = '\x1b[0m'

    console.log(
      `\n${statusColor}${statusIcon} OVERALL: ${dashboard.overall.status.toUpperCase()}${resetColor}`,
    )
    console.log(`  Score: ${dashboard.overall.score}/100`)
    console.log(`  Success Rate: ${(dashboard.overall.successRate * 100).toFixed(1)}%`)
    console.log(`  Total Recent Failures: ${dashboard.overall.recentFailures}`)

    // System alerts
    if (dashboard.systemAlerts.length > 0) {
      console.log('\nSYSTEM ALERTS:')
      dashboard.systemAlerts.forEach((alert) => {
        const alertIcon = this.getAlertIcon(alert.severity)
        console.log(`  ${alertIcon} ${alert.message}`)
      })
    }

    // Per-script health
    if (dashboard.scripts.length > 0) {
      console.log('\n\nSCRIPT HEALTH:\n')
      console.log('─'.repeat(60))

      for (const script of dashboard.scripts) {
        const scriptColor = this.getStatusColor(script.status.status)
        const scriptIcon = this.getStatusIcon(script.status.status)

        console.log(`\n${scriptColor}${scriptIcon} ${script.scriptName}${resetColor}`)
        console.log(`  Status: ${script.status.status} (${script.status.score}/100)`)
        console.log(`  Success Rate: ${(script.status.successRate * 100).toFixed(1)}%`)
        console.log(`  Trend: ${this.getTrendIcon(script.status.trend)} ${script.status.trend}`)

        if (script.alerts.length > 0) {
          console.log('  Alerts:')
          script.alerts.forEach((alert) => {
            const alertIcon = this.getAlertIcon(alert.severity)
            console.log(`    ${alertIcon} ${alert.message}`)
          })
        }
      }
    }

    console.log(`\n\nGenerated: ${dashboard.timestamp.toLocaleString()}\n`)

    return this.output.success({ dashboard })
  }

  /**
   * Show health history
   */
  private async history() {
    const scriptName = this.requirePositional(0, 'script')
    const days = this.getFlag('days', 7)
    const limit = this.getFlag('limit', 20)

    const monitor = await getHealthMonitor(PROJECT_ROOT)
    const history = await monitor.getHealthHistory(scriptName, { days, limit })

    if (this.args.flags.json) {
      return this.output.success({ history })
    }

    if (history.length === 0) {
      this.output.warn(`No health history found for ${scriptName}`)
      return this.output.success({ total: 0 })
    }

    console.log(`\nHealth History: ${scriptName} (last ${days} days)\n`)
    console.log('─'.repeat(60))

    for (const snapshot of history) {
      const statusColor = this.getStatusColor(snapshot.status.status)
      const statusIcon = this.getStatusIcon(snapshot.status.status)
      const resetColor = '\x1b[0m'

      console.log(`\n${snapshot.timestamp.toLocaleString()}`)
      console.log(
        `${statusColor}${statusIcon} ${snapshot.status.status.toUpperCase()}${resetColor} (score: ${snapshot.status.score}/100)`,
      )
      console.log(`  Success Rate: ${(snapshot.status.successRate * 100).toFixed(1)}%`)
      console.log(`  Trend: ${this.getTrendIcon(snapshot.status.trend)} ${snapshot.status.trend}`)

      if (snapshot.alerts.length > 0) {
        console.log('  Alerts:')
        snapshot.alerts.forEach((alert) => {
          const alertIcon = this.getAlertIcon(alert.severity)
          console.log(`    ${alertIcon} ${alert.message}`)
        })
      }
    }

    console.log()

    return this.output.success({ total: history.length })
  }

  /**
   * Show active alerts
   */
  private async alerts() {
    const scriptName = this.getPositional(0)

    const monitor = await getHealthMonitor(PROJECT_ROOT)
    const dashboard = await monitor.getDashboard()

    let alerts = dashboard.systemAlerts
    let title = 'System Alerts'

    if (scriptName) {
      const scriptHealth = dashboard.scripts.find((s) => s.scriptName === scriptName)
      if (scriptHealth) {
        alerts = scriptHealth.alerts
        title = `Alerts: ${scriptName}`
      } else {
        this.output.warn(`Script not found: ${scriptName}`)
        return this.output.success({ total: 0 })
      }
    } else {
      // Include all script alerts
      for (const script of dashboard.scripts) {
        alerts = alerts.concat(script.alerts)
      }
      title = 'All Active Alerts'
    }

    if (this.args.flags.json) {
      return this.output.success({ alerts })
    }

    if (alerts.length === 0) {
      this.output.success('No active alerts')
      return this.output.success({ total: 0 })
    }

    console.log(`\n${title}\n`)
    console.log('─'.repeat(60))

    // Group by severity
    const critical = alerts.filter((a) => a.severity === 'critical')
    const warnings = alerts.filter((a) => a.severity === 'warning')
    const info = alerts.filter((a) => a.severity === 'info')

    if (critical.length > 0) {
      console.log('\nCRITICAL:')
      critical.forEach((alert) => {
        const alertIcon = this.getAlertIcon(alert.severity)
        console.log(`  ${alertIcon} ${alert.scriptName}: ${alert.message}`)
        console.log(`     ${alert.timestamp.toLocaleString()}`)
      })
    }

    if (warnings.length > 0) {
      console.log('\nWARNING:')
      warnings.forEach((alert) => {
        const alertIcon = this.getAlertIcon(alert.severity)
        console.log(`  ${alertIcon} ${alert.scriptName}: ${alert.message}`)
        console.log(`     ${alert.timestamp.toLocaleString()}`)
      })
    }

    if (info.length > 0) {
      console.log('\nINFO:')
      info.forEach((alert) => {
        const alertIcon = this.getAlertIcon(alert.severity)
        console.log(`  ${alertIcon} ${alert.scriptName}: ${alert.message}`)
        console.log(`     ${alert.timestamp.toLocaleString()}`)
      })
    }

    console.log()

    return this.output.success({ total: alerts.length })
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getStatusColor(status: HealthStatus['status']): string {
    switch (status) {
      case 'healthy':
        return '\x1b[32m' // Green
      case 'degraded':
        return '\x1b[33m' // Yellow
      case 'unhealthy':
        return '\x1b[31m' // Red
      case 'critical':
        return '\x1b[91m' // Bright red
      default:
        return '\x1b[0m'
    }
  }

  private getStatusIcon(status: HealthStatus['status']): string {
    switch (status) {
      case 'healthy':
        return '✓'
      case 'degraded':
        return '⚠'
      case 'unhealthy':
        return '✗'
      case 'critical':
        return '✗✗'
      default:
        return '?'
    }
  }

  private getTrendIcon(trend: HealthStatus['trend']): string {
    switch (trend) {
      case 'improving':
        return '↑'
      case 'stable':
        return '→'
      case 'degrading':
        return '↓'
      default:
        return '?'
    }
  }

  private getAlertIcon(severity: 'info' | 'warning' | 'critical'): string {
    switch (severity) {
      case 'critical':
        return '\x1b[91m✗\x1b[0m' // Bright red
      case 'warning':
        return '\x1b[33m⚠\x1b[0m' // Yellow
      case 'info':
        return '\x1b[36mℹ\x1b[0m' // Cyan
      default:
        return '?'
    }
  }
}

// Run CLI
runCLI(HealthCLI)
