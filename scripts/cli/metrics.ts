#!/usr/bin/env tsx
/**
 * Metrics and telemetry CLI.
 *
 * View script execution metrics, performance stats, and error analytics.
 *
 * @example
 * ```bash
 * pnpm metrics                  # Show metrics summary
 * pnpm metrics:dashboard        # Show full dashboard
 * pnpm metrics:scripts          # Script execution stats
 * pnpm metrics:errors           # Error analytics
 * pnpm metrics:clear            # Clear all metrics
 * ```
 */

import { BaseCLI } from './_base.js'
import { telemetry, type AggregatedMetrics } from '../lib/telemetry.js'
import { formatDuration } from '../lib/utils.js'
import type { CommandDefinition, ParsedArgs } from '../lib/args.js'

class MetricsCLI extends BaseCLI {
  name = 'metrics'
  description = 'Script execution metrics and analytics'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'summary',
        description: 'Show metrics summary',
        handler: async (args) => this.showSummary(args),
      },
      {
        name: 'dashboard',
        description: 'Show full metrics dashboard',
        handler: async (args) => this.showDashboard(args),
      },
      {
        name: 'scripts',
        description: 'Script execution statistics',
        handler: async (args) => this.showScriptStats(args),
      },
      {
        name: 'cache',
        description: 'Cache performance metrics',
        handler: async (args) => this.showCacheMetrics(args),
      },
      {
        name: 'errors',
        description: 'Error analytics',
        handler: async (args) => this.showErrors(args),
      },
      {
        name: 'clear',
        description: 'Clear all metrics',
        options: [
          {
            name: 'confirm',
            type: 'boolean',
            description: 'Skip confirmation prompt',
          },
        ],
        handler: async (args) => this.clearMetrics(args),
      },
    ]
  }

  /**
   * Get metrics for specified period.
   */
  private async getMetrics(args: ParsedArgs): Promise<AggregatedMetrics> {
    const days = (args.days as number) || 7
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    return await telemetry.getMetrics(startDate, endDate)
  }

  /**
   * Show metrics summary.
   */
  private async showSummary(args: ParsedArgs): Promise<number> {
    const metrics = await this.getMetrics(args)

    if (args.json) {
      this.output.success({ metrics })
      return 0
    }

    this.output.header('Metrics Summary')

    console.log('\nOverview:')
    console.log(`  Total Events:       ${metrics.totalEvents}`)
    console.log(`  Script Executions:  ${metrics.scripts.totalExecutions}`)
    console.log(`  Total Errors:       ${metrics.errors.total}`)

    console.log('\nPerformance:')
    console.log(`  Average Duration:   ${formatDuration(metrics.performance.averageScriptDuration)}`)
    console.log(`  Total Duration:     ${metrics.performance.formattedTotalDuration}`)

    console.log('\nCache:')
    console.log(`  Hit Rate:          ${metrics.cache.hitRate}%`)
    console.log(`  Total Size:        ${metrics.cache.formattedSize}`)

    return 0
  }

  /**
   * Show full dashboard.
   */
  private async showDashboard(args: ParsedArgs): Promise<number> {
    const metrics = await this.getMetrics(args)

    if (args.json) {
      this.output.success({ metrics })
      return 0
    }

    this.output.header('Performance Dashboard')

    // Overview Section
    console.log('\n📊 Overview')
    console.log(`  Total Events:       ${metrics.totalEvents}`)
    console.log(`  Period:             ${new Date(metrics.period.start).toLocaleDateString()} - ${new Date(metrics.period.end).toLocaleDateString()}`)
    console.log(`  Duration:           ${formatDuration(metrics.period.duration)}`)

    // Script Execution Section
    console.log('\n⚡ Script Execution')
    console.log(`  Total Executions:   ${metrics.scripts.totalExecutions}`)
    console.log(`  Average Duration:   ${formatDuration(metrics.scripts.averageDuration)}`)
    console.log(`  Failures:           ${metrics.scripts.failures}`)

    if (metrics.scripts.slowest.length > 0) {
      console.log('\n  Slowest Scripts:')
      for (const script of metrics.scripts.slowest) {
        console.log(`    - ${script.name}: ${formatDuration(script.duration)}`)
      }
    }

    // Cache Performance Section
    console.log('\n💾 Cache Performance')
    console.log(`  Hit Rate:          ${metrics.cache.hitRate}%`)
    console.log(`  Hits:              ${metrics.cache.hits}`)
    console.log(`  Misses:            ${metrics.cache.misses}`)
    console.log(`  Total Size:        ${metrics.cache.formattedSize}`)

    // Error Analytics Section
    console.log('\n❌ Errors')
    console.log(`  Total:             ${metrics.errors.total}`)

    if (Object.keys(metrics.errors.byType).length > 0) {
      console.log('\n  By Type:')
      for (const [type, count] of Object.entries(metrics.errors.byType)) {
        console.log(`    - ${type}: ${count}`)
      }
    }

    if (metrics.errors.recent.length > 0) {
      console.log('\n  Recent Errors:')
      for (const error of metrics.errors.recent.slice(0, 5)) {
        const date = new Date(error.timestamp).toLocaleString()
        console.log(`    - ${error.name} (${date})`)
        if (error.message) {
          console.log(`      ${error.message}`)
        }
      }
    }

    // Event Type Distribution
    console.log('\n📈 Event Distribution')
    for (const [type, count] of Object.entries(metrics.eventsByType)) {
      const percentage = ((count / metrics.totalEvents) * 100).toFixed(1)
      console.log(`  ${type.padEnd(10)} ${count.toString().padStart(6)}  (${percentage}%)`)
    }

    return 0
  }

  /**
   * Show script execution statistics.
   */
  private async showScriptStats(args: ParsedArgs): Promise<number> {
    const metrics = await this.getMetrics(args)

    if (args.json) {
      this.output.success({
        scripts: metrics.scripts,
        performance: metrics.performance,
      })
      return 0
    }

    this.output.header('Script Execution Statistics')

    console.log(`\nTotal Executions: ${metrics.scripts.totalExecutions}`)
    console.log(`Average Duration: ${formatDuration(metrics.scripts.averageDuration)}`)
    console.log(`Total Duration:   ${metrics.performance.formattedTotalDuration}`)
    console.log(`Failures:         ${metrics.scripts.failures}`)

    if (metrics.scripts.slowest.length > 0) {
      console.log('\nSlowest Scripts:')
      for (const script of metrics.scripts.slowest) {
        console.log(`  ${script.name.padEnd(30)} ${formatDuration(script.duration)}`)
      }
    }

    if (metrics.scripts.fastest.length > 0) {
      console.log('\nFastest Scripts:')
      for (const script of metrics.scripts.fastest) {
        console.log(`  ${script.name.padEnd(30)} ${formatDuration(script.duration)}`)
      }
    }

    return 0
  }

  /**
   * Show cache performance metrics.
   */
  private async showCacheMetrics(args: ParsedArgs): Promise<number> {
    const metrics = await this.getMetrics(args)

    if (args.json) {
      this.output.success({ cache: metrics.cache })
      return 0
    }

    this.output.header('Cache Performance')

    console.log(`\nHit Rate:    ${metrics.cache.hitRate}%`)
    console.log(`Hits:        ${metrics.cache.hits}`)
    console.log(`Misses:      ${metrics.cache.misses}`)
    console.log(`Total Size:  ${metrics.cache.formattedSize}`)

    // Performance assessment
    console.log('\nAssessment:')
    if (metrics.cache.hitRate >= 70) {
      console.log('  ✅ Excellent cache performance (target: >70%)')
    } else if (metrics.cache.hitRate >= 50) {
      console.log('  ⚠️  Good cache performance, room for improvement')
    } else {
      console.log('  ❌ Poor cache performance, optimization needed')
    }

    return 0
  }

  /**
   * Show error analytics.
   */
  private async showErrors(args: ParsedArgs): Promise<number> {
    const metrics = await this.getMetrics(args)

    if (args.json) {
      this.output.success({ errors: metrics.errors })
      return 0
    }

    this.output.header('Error Analytics')

    console.log(`\nTotal Errors: ${metrics.errors.total}`)

    if (Object.keys(metrics.errors.byType).length > 0) {
      console.log('\nBy Type:')
      for (const [type, count] of Object.entries(metrics.errors.byType)) {
        console.log(`  ${type.padEnd(30)} ${count}`)
      }
    }

    if (metrics.errors.recent.length > 0) {
      console.log('\nRecent Errors:')
      for (const error of metrics.errors.recent) {
        const date = new Date(error.timestamp).toLocaleString()
        console.log(`\n  ${error.name}`)
        console.log(`  Time: ${date}`)
        if (error.message) {
          console.log(`  Message: ${error.message}`)
        }
      }
    } else {
      console.log('\n✅ No errors recorded')
    }

    return 0
  }

  /**
   * Clear all metrics.
   */
  private async clearMetrics(args: ParsedArgs): Promise<number> {
    if (!args.confirm && !args.json) {
      const readline = await import('node:readline/promises')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await rl.question('Clear all metrics? [y/N] ')
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled')
        return 0
      }
    }

    telemetry.clear()

    if (args.json) {
      this.output.success({ cleared: true })
    } else {
      this.output.success('All metrics cleared')
    }

    return 0
  }
}

// Run CLI
const cli = new MetricsCLI()
const exitCode = await cli.run()
process.exit(exitCode)
