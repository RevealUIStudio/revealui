import { getUsageAnalytics } from '../lib/analytics/usage-analytics.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

class AnalyticsCLI extends BaseCLI {
  name = 'analytics'
  description = 'Usage analytics and trend analysis'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'dashboard',
        description: 'View comprehensive analytics dashboard',
        args: [
          {
            name: 'days',
            type: 'number',
            description: 'Number of days to analyze (default: 30)',
          },
          {
            name: 'min',
            type: 'number',
            description: 'Minimum executions to include (default: 5)',
          },
        ],
        handler: async () => {
          await this.showDashboard()
          return undefined
        },
      },
      {
        name: 'script',
        description: 'View analytics for a specific script',
        args: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Script name',
          },
          {
            name: 'days',
            type: 'number',
            description: 'Number of days to analyze (default: 30)',
          },
        ],
        handler: async () => {
          await this.showScriptAnalytics()
          return undefined
        },
      },
      {
        name: 'trends',
        description: 'View performance trends',
        args: [
          {
            name: 'days',
            type: 'number',
            description: 'Number of days to analyze (default: 30)',
          },
        ],
        handler: async () => {
          await this.showTrends()
          return undefined
        },
      },
      {
        name: 'activity',
        description: 'View activity patterns',
        args: [
          {
            name: 'days',
            type: 'number',
            description: 'Number of days to analyze (default: 7)',
          },
        ],
        handler: async () => {
          await this.showActivity()
          return undefined
        },
      },
    ]
  }

  private async showDashboard(): Promise<void> {
    const days = this.getFlag('days', 30)
    const minExecutions = this.getFlag('min', 5)

    const analytics = await getUsageAnalytics(this.projectRoot)
    const dashboard = await analytics.getDashboard({ days, minExecutions })

    if (this.args.flags.json) {
      this.output.success({ dashboard })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n📊 Usage Analytics Dashboard\n`)
    logger.info(
      `Period: ${dashboard.period.startDate.toLocaleDateString()} - ${dashboard.period.endDate.toLocaleDateString()} (${dashboard.period.days} days)\n`,
    )

    // Overall statistics
    logger.info('Overall Statistics:')
    logger.info(`  Total executions: ${dashboard.overall.totalExecutions}`)
    logger.info(`  Total scripts: ${dashboard.overall.totalScripts}`)
    logger.info(
      `  Total duration: ${(dashboard.overall.totalDuration / 1000 / 60).toFixed(1)} minutes`,
    )
    logger.info(`  Average success rate: ${dashboard.overall.averageSuccessRate.toFixed(1)}%`)
    logger.info(`  Average duration: ${(dashboard.overall.averageDuration / 1000).toFixed(2)}s`)
    logger.info('')

    // Most used scripts
    if (dashboard.mostUsedScripts.length > 0) {
      logger.info(`Most Used Scripts (${dashboard.mostUsedScripts.length}):\n`)
      for (const script of dashboard.mostUsedScripts) {
        logger.info(`  ${script.scriptName}`)
        logger.info(`    Executions: ${script.totalExecutions} (${script.executionsPerDay}/day)`)
        logger.info(`    Success rate: ${script.successRate.toFixed(1)}%`)
        logger.info(`    Avg duration: ${(script.averageDuration / 1000).toFixed(2)}s`)
        logger.info('')
      }
    }

    // Scripts with highest failure rates
    if (dashboard.mostFailingScripts.length > 0) {
      logger.warning(
        `\nScripts with Highest Failure Rates (${dashboard.mostFailingScripts.length}):\n`,
      )
      for (const script of dashboard.mostFailingScripts) {
        logger.warning(`  ${script.scriptName}`)
        logger.warning(`    Success rate: ${script.successRate.toFixed(1)}%`)
        logger.warning(`    Failures: ${script.failedExecutions}/${script.totalExecutions}`)
        logger.info('')
      }
    }

    // Fastest scripts
    if (dashboard.fastestScripts.length > 0 && this.isVerbose()) {
      logger.info(`Fastest Scripts (${dashboard.fastestScripts.length}):\n`)
      for (const script of dashboard.fastestScripts) {
        logger.info(`  ${script.scriptName}`)
        logger.info(`    Avg duration: ${(script.averageDuration / 1000).toFixed(2)}s`)
        logger.info('')
      }
    }

    // Slowest scripts
    if (dashboard.slowestScripts.length > 0) {
      logger.info(`Slowest Scripts (${dashboard.slowestScripts.length}):\n`)
      for (const script of dashboard.slowestScripts) {
        logger.info(`  ${script.scriptName}`)
        logger.info(`    Avg duration: ${(script.averageDuration / 1000).toFixed(2)}s`)
        logger.info('')
      }
    }

    // Trends
    logger.info('Execution Trend:')
    this.displayTrend(dashboard.executionTrend, 'executions/day')

    logger.info('\nPerformance Trend:')
    this.displayTrend(dashboard.performanceTrend, 's average', true)

    logger.info('\nSuccess Rate Trend:')
    this.displayTrend(dashboard.successRateTrend, '% success rate')
  }

  private async showScriptAnalytics(): Promise<void> {
    const scriptName = this.requirePositional(0, 'name')
    const days = this.getFlag('days', 30)

    const analytics = await getUsageAnalytics(this.projectRoot)
    const stats = await analytics.getScriptStats(scriptName, { days })

    if (this.args.flags.json) {
      this.output.success({ stats })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n📈 Analytics for ${scriptName}\n`)

    logger.info('Usage Statistics:')
    logger.info(`  Total executions: ${stats.totalExecutions}`)
    logger.info(`  Executions/day: ${stats.executionsPerDay}`)
    logger.info(`  Unique users: ${stats.uniqueUsers}`)
    logger.info(
      `  Last execution: ${stats.lastExecution ? stats.lastExecution.toLocaleString() : 'Never'}`,
    )
    logger.info(`  Most common command: ${stats.mostCommonCommand || 'N/A'}`)
    logger.info('')

    logger.info('Success Rate:')
    logger.info(`  Overall: ${stats.successRate.toFixed(1)}%`)
    logger.info(`  Successful: ${stats.successfulExecutions}`)
    logger.info(`  Failed: ${stats.failedExecutions}`)
    logger.info('')

    logger.info('Performance:')
    logger.info(`  Average duration: ${(stats.averageDuration / 1000).toFixed(2)}s`)
    logger.info(`  Total duration: ${(stats.totalDuration / 1000 / 60).toFixed(1)} minutes`)
    logger.info('')
  }

  private async showTrends(): Promise<void> {
    const days = this.getFlag('days', 30)

    const analytics = await getUsageAnalytics(this.projectRoot)
    const dashboard = await analytics.getDashboard({ days })

    if (this.args.flags.json) {
      this.output.success({
        executionTrend: dashboard.executionTrend,
        performanceTrend: dashboard.performanceTrend,
        successRateTrend: dashboard.successRateTrend,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n📈 Performance Trends (${days} days)\n`)

    logger.info('Execution Trend:')
    this.displayTrend(dashboard.executionTrend, 'executions/day', false, true)

    logger.info('\nPerformance Trend:')
    this.displayTrend(dashboard.performanceTrend, 'ms average', true, true)

    logger.info('\nSuccess Rate Trend:')
    this.displayTrend(dashboard.successRateTrend, '% success rate', false, true)
  }

  private async showActivity(): Promise<void> {
    const days = this.getFlag('days', 7)

    const analytics = await getUsageAnalytics(this.projectRoot)

    const byHour = await analytics.calculateActivityByHour(days)
    const byDay = await analytics.calculateActivityByDay(days)

    if (this.args.flags.json) {
      this.output.success({ byHour, byDay })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n📅 Activity Patterns (${days} days)\n`)

    // Activity by hour of day
    logger.info('Activity by Hour of Day:\n')
    const maxHourCount = Math.max(...byHour.map((h) => h.count))
    for (const { hour, count } of byHour) {
      const bar = this.generateBar(count, maxHourCount, 30)
      const hourStr = hour.toString().padStart(2, '0')
      logger.info(`  ${hourStr}:00 ${bar} ${count}`)
    }
    logger.info('')

    // Activity by day of week
    logger.info('Activity by Day of Week:\n')
    const maxDayCount = Math.max(...byDay.map((d) => d.count))
    for (const { day, count } of byDay) {
      const bar = this.generateBar(count, maxDayCount, 30)
      const dayStr = day.padEnd(10)
      logger.info(`  ${dayStr} ${bar} ${count}`)
    }
    logger.info('')
  }

  /**
   * Display trend information
   */
  private displayTrend(
    trend: any,
    unit: string,
    invertColors = false,
    showDataPoints = false,
  ): void {
    const logger = this.output.getLogger()

    const trendIcon = {
      improving: '✅',
      stable: '➖',
      degrading: '⚠️ ',
    }[trend.trend]

    const trendText = trend.trend.toUpperCase()

    logger.info(`  ${trendIcon} ${trendText}`)
    logger.info(`  Current: ${trend.current} ${unit}`)
    logger.info(`  Previous: ${trend.previous} ${unit}`)

    if (trend.changePercent !== 0) {
      const sign = trend.changePercent > 0 ? '+' : ''
      const changeText = `  Change: ${sign}${trend.changePercent}%`

      // Use appropriate logger method for colored output
      if (trend.changePercent > 10) {
        if (invertColors) {
          logger.error(changeText)
        } else {
          logger.success(changeText)
        }
      } else if (trend.changePercent < -10) {
        if (invertColors) {
          logger.success(changeText)
        } else {
          logger.error(changeText)
        }
      } else {
        logger.info(changeText)
      }
    }

    if (showDataPoints && this.isVerbose()) {
      logger.info('\n  Daily breakdown:')
      for (const point of trend.dataPoints.slice(-7)) {
        logger.info(`    ${point.date}: ${point.value.toFixed(2)}`)
      }
    }
  }

  /**
   * Generate an ASCII bar chart
   */
  private generateBar(value: number, maxValue: number, width: number): string {
    if (maxValue === 0) return '░'.repeat(width)

    const filledWidth = Math.round((value / maxValue) * width)
    const emptyWidth = width - filledWidth

    return '█'.repeat(filledWidth) + '░'.repeat(emptyWidth)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(AnalyticsCLI)
}

export { AnalyticsCLI }
