#!/usr/bin/env tsx
/**
 * Performance Dashboard CLI
 *
 * Real-time performance monitoring and metrics visualization.
 * Displays telemetry, profiling, cache stats, and system health.
 *
 * @example
 * ```bash
 * pnpm dashboard              # Launch interactive dashboard
 * pnpm dashboard:watch        # Auto-refresh mode
 * pnpm dashboard:report       # Generate HTML report
 * pnpm dashboard:summary      # Quick summary view
 * ```
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { cpus, freemem, totalmem } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { CommandDefinition, ParsedArgs } from '../lib/args.js'
import { BuildCache } from '../lib/cache.js'
import { getProjectRoot } from '../lib/paths.js'
import { Telemetry } from '../lib/telemetry.js'
import { formatBytes, formatDuration } from '../lib/utils.js'
import { BaseCLI } from './_base.js'

interface DashboardData {
  timestamp: number
  system: {
    cpuUsage: number
    memoryUsed: number
    memoryTotal: number
    memoryFree: number
    uptime: number
  }
  telemetry: {
    totalEvents: number
    counters: Record<string, number>
    recentTimers: Array<{ name: string; duration: number }>
    recentErrors: Array<{ name: string; message: string }>
  }
  cache: {
    hits: number
    misses: number
    size: number
    entryCount: number
  }
  scripts: {
    totalExecutions: number
    averageDuration: number
    failureRate: number
    topScripts: Array<{ name: string; count: number }>
  }
}

class DashboardCLI extends BaseCLI {
  name = 'dashboard'
  description = 'Performance monitoring and metrics dashboard'

  private telemetry: Telemetry
  private cache: BuildCache
  private projectRoot: string = ''

  constructor() {
    super()
    this.telemetry = new Telemetry()
    this.cache = new BuildCache()
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'interactive',
        description: 'Launch interactive dashboard (default)',
        options: [
          {
            name: 'refresh',
            type: 'number',
            description: 'Refresh interval in seconds',
            defaultValue: 5,
          },
        ],
        handler: async (args) => this.runInteractive(args),
      },
      {
        name: 'watch',
        description: 'Auto-refresh dashboard',
        options: [
          {
            name: 'interval',
            type: 'number',
            description: 'Refresh interval in seconds',
            defaultValue: 3,
          },
        ],
        handler: async (args) => this.runWatch(args),
      },
      {
        name: 'report',
        description: 'Generate HTML performance report',
        options: [
          {
            name: 'output',
            type: 'string',
            description: 'Output file path',
            defaultValue: 'performance-report.html',
          },
          {
            name: 'days',
            type: 'number',
            description: 'Number of days to include',
            defaultValue: 7,
          },
        ],
        handler: async (args) => this.generateReport(args),
      },
      {
        name: 'summary',
        description: 'Show quick performance summary',
        handler: async (args) => this.showSummary(args),
      },
    ]
  }

  /**
   * Launch interactive dashboard
   */
  private async runInteractive(args: ParsedArgs): Promise<number> {
    this.projectRoot = await getProjectRoot(import.meta.url)
    const refreshInterval = (args.refresh as number) || 5

    if (!args.json) {
      console.clear()
      this.output.header('📊 Performance Dashboard')
      console.log(`Refresh: ${refreshInterval}s | Press Ctrl+C to exit\n`)
    }

    const data = await this.collectData()

    if (args.json) {
      this.output.success({ data })
    } else {
      this.renderDashboard(data)
    }

    return 0
  }

  /**
   * Watch mode with auto-refresh
   */
  private async runWatch(args: ParsedArgs): Promise<number> {
    this.projectRoot = await getProjectRoot(import.meta.url)
    const interval = (args.interval as number) || 3

    console.clear()
    this.output.header('📊 Performance Dashboard (Watch Mode)')
    console.log(`Auto-refresh: ${interval}s | Press Ctrl+C to exit\n`)

    // Initial render
    let data = await this.collectData()
    this.renderDashboard(data)

    // Auto-refresh loop
    const intervalId = setInterval(async () => {
      console.clear()
      this.output.header('📊 Performance Dashboard (Watch Mode)')
      console.log(`Auto-refresh: ${interval}s | Press Ctrl+C to exit\n`)

      data = await this.collectData()
      this.renderDashboard(data)
    }, interval * 1000)

    // Handle cleanup
    process.on('SIGINT', () => {
      clearInterval(intervalId)
      console.log('\n\n👋 Dashboard stopped')
      process.exit(0)
    })

    // Keep process alive
    return new Promise(() => {})
  }

  /**
   * Generate HTML performance report
   */
  private async generateReport(args: ParsedArgs): Promise<number> {
    this.projectRoot = await getProjectRoot(import.meta.url)
    const outputPath = (args.output as string) || 'performance-report.html'
    const days = (args.days as number) || 7

    if (!args.json) {
      this.output.header('📄 Generating Performance Report')
      console.log(`Output: ${outputPath}`)
      console.log(`Period: Last ${days} days\n`)
    }

    // Collect historical data
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    const metrics = await this.telemetry.getMetrics(startDate, endDate)
    const cacheStats = await this.cache.getStats()
    const currentData = await this.collectData()

    // Generate HTML report
    const html = this.generateHTMLReport({
      currentData,
      metrics,
      cacheStats,
      startDate,
      endDate,
    })

    // Write report
    await writeFile(outputPath, html, 'utf-8')

    if (args.json) {
      this.output.success({ reportPath: outputPath, size: html.length })
    } else {
      console.log(`✅ Report generated: ${outputPath}`)
      console.log(`   Size: ${formatBytes(html.length)}`)
      console.log(`\nOpen in browser: file://${join(this.projectRoot, outputPath)}`)
    }

    return 0
  }

  /**
   * Show quick summary
   */
  private async showSummary(args: ParsedArgs): Promise<number> {
    this.projectRoot = await getProjectRoot(import.meta.url)
    const data = await this.collectData()

    if (args.json) {
      this.output.success({ summary: data })
      return 0
    }

    this.output.header('📊 Performance Summary')

    // System
    console.log('\n🖥️  System:')
    console.log(`   CPU Usage:     ${data.system.cpuUsage.toFixed(1)}%`)
    console.log(`   Memory Used:   ${formatBytes(data.system.memoryUsed)} / ${formatBytes(data.system.memoryTotal)}`)
    console.log(`   Memory Free:   ${formatBytes(data.system.memoryFree)}`)

    // Telemetry
    console.log('\n📈 Telemetry:')
    console.log(`   Total Events:  ${data.telemetry.totalEvents}`)
    console.log(`   Recent Errors: ${data.telemetry.recentErrors.length}`)

    // Cache
    console.log('\n💾 Cache:')
    console.log(`   Hit Rate:      ${data.cache.hits + data.cache.misses > 0 ? ((data.cache.hits / (data.cache.hits + data.cache.misses)) * 100).toFixed(1) : 0}%`)
    console.log(`   Entries:       ${data.cache.entryCount}`)
    console.log(`   Size:          ${formatBytes(data.cache.size)}`)

    // Scripts
    console.log('\n⚡ Scripts:')
    console.log(`   Executions:    ${data.scripts.totalExecutions}`)
    console.log(`   Avg Duration:  ${formatDuration(data.scripts.averageDuration)}`)
    console.log(`   Failure Rate:  ${(data.scripts.failureRate * 100).toFixed(1)}%`)

    return 0
  }

  /**
   * Collect all dashboard data
   */
  private async collectData(): Promise<DashboardData> {
    const startTime = performance.now()

    // System metrics
    const memoryUsed = totalmem() - freemem()
    const cpuUsagePercent = await this.getCPUUsage()

    // Telemetry metrics
    const metrics = await this.telemetry.getMetrics()
    const totalEvents =
      Object.values(metrics.counters).reduce((sum, val) => sum + val, 0) +
      metrics.timers.length +
      metrics.errors.length

    // Cache metrics
    const cacheStats = await this.cache.getStats()

    // Script execution metrics
    const scriptMetrics = this.extractScriptMetrics(metrics)

    const endTime = performance.now()
    const collectionTime = endTime - startTime

    return {
      timestamp: Date.now(),
      system: {
        cpuUsage: cpuUsagePercent,
        memoryUsed,
        memoryTotal: totalmem(),
        memoryFree: freemem(),
        uptime: process.uptime(),
      },
      telemetry: {
        totalEvents,
        counters: metrics.counters,
        recentTimers: metrics.timers.slice(-10).map((t) => ({
          name: t.name,
          duration: t.duration || 0,
        })),
        recentErrors: metrics.errors.slice(-10).map((e) => ({
          name: e.name,
          message: e.error?.toString() || 'Unknown error',
        })),
      },
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size: cacheStats.totalSize,
        entryCount: cacheStats.entryCount,
      },
      scripts: scriptMetrics,
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    const startUsage = process.cpuUsage()
    const startTime = performance.now()

    await new Promise((resolve) => setTimeout(resolve, 100))

    const endUsage = process.cpuUsage(startUsage)
    const endTime = performance.now()

    const elapsedTime = (endTime - startTime) * 1000 // Convert to microseconds
    const totalUsage = endUsage.user + endUsage.system

    return Math.min(100, (totalUsage / elapsedTime) * 100)
  }

  /**
   * Extract script execution metrics from telemetry
   */
  private extractScriptMetrics(metrics: any): {
    totalExecutions: number
    averageDuration: number
    failureRate: number
    topScripts: Array<{ name: string; count: number }>
  } {
    const scriptTimers = metrics.timers.filter((t: any) => t.name.includes('script') || t.name.includes('build') || t.name.includes('test'))
    const totalExecutions = scriptTimers.length
    const averageDuration = totalExecutions > 0 ? scriptTimers.reduce((sum: number, t: any) => sum + (t.duration || 0), 0) / totalExecutions : 0

    const scriptErrors = metrics.errors.filter((e: any) => e.name.includes('script') || e.name.includes('build') || e.name.includes('test'))
    const failureRate = totalExecutions > 0 ? scriptErrors.length / totalExecutions : 0

    // Count script executions
    const scriptCounts: Record<string, number> = {}
    for (const timer of scriptTimers) {
      scriptCounts[timer.name] = (scriptCounts[timer.name] || 0) + 1
    }

    const topScripts = Object.entries(scriptCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return {
      totalExecutions,
      averageDuration,
      failureRate,
      topScripts,
    }
  }

  /**
   * Render terminal dashboard
   */
  private renderDashboard(data: DashboardData): void {
    const width = process.stdout.columns || 80

    // Header
    console.log('='.repeat(width))
    console.log('  PERFORMANCE DASHBOARD')
    console.log('  ' + new Date(data.timestamp).toLocaleString())
    console.log('='.repeat(width))

    // System Section
    console.log('\n🖥️  SYSTEM')
    console.log('─'.repeat(width))
    this.renderMetric('CPU Usage', `${data.system.cpuUsage.toFixed(1)}%`, this.getHealthIndicator(data.system.cpuUsage, 80, 50))
    this.renderMetric('Memory Used', formatBytes(data.system.memoryUsed), this.getHealthIndicator((data.system.memoryUsed / data.system.memoryTotal) * 100, 90, 70))
    this.renderMetric('Memory Free', formatBytes(data.system.memoryFree), '')
    this.renderMetric('Uptime', formatDuration(data.system.uptime * 1000), '')

    // Telemetry Section
    console.log('\n📈 TELEMETRY')
    console.log('─'.repeat(width))
    this.renderMetric('Total Events', data.telemetry.totalEvents.toString(), '')
    this.renderMetric('Recent Errors', data.telemetry.recentErrors.length.toString(), data.telemetry.recentErrors.length > 0 ? '⚠️' : '✅')

    if (data.telemetry.recentTimers.length > 0) {
      console.log('\n  Recent Operations:')
      for (const timer of data.telemetry.recentTimers.slice(-5)) {
        console.log(`    • ${timer.name}: ${formatDuration(timer.duration)}`)
      }
    }

    if (data.telemetry.recentErrors.length > 0) {
      console.log('\n  Recent Errors:')
      for (const error of data.telemetry.recentErrors.slice(-3)) {
        console.log(`    ⚠️  ${error.name}: ${error.message.substring(0, 60)}`)
      }
    }

    // Cache Section
    console.log('\n💾 CACHE')
    console.log('─'.repeat(width))
    const hitRate = data.cache.hits + data.cache.misses > 0 ? (data.cache.hits / (data.cache.hits + data.cache.misses)) * 100 : 0
    this.renderMetric('Hit Rate', `${hitRate.toFixed(1)}%`, this.getHealthIndicator(hitRate, 30, 60))
    this.renderMetric('Hits / Misses', `${data.cache.hits} / ${data.cache.misses}`, '')
    this.renderMetric('Entries', data.cache.entryCount.toString(), '')
    this.renderMetric('Size', formatBytes(data.cache.size), '')

    // Scripts Section
    console.log('\n⚡ SCRIPTS')
    console.log('─'.repeat(width))
    this.renderMetric('Total Executions', data.scripts.totalExecutions.toString(), '')
    this.renderMetric('Avg Duration', formatDuration(data.scripts.averageDuration), '')
    this.renderMetric('Failure Rate', `${(data.scripts.failureRate * 100).toFixed(1)}%`, data.scripts.failureRate > 0.1 ? '⚠️' : '✅')

    if (data.scripts.topScripts.length > 0) {
      console.log('\n  Top Scripts:')
      for (const script of data.scripts.topScripts) {
        console.log(`    • ${script.name}: ${script.count}x`)
      }
    }

    console.log('\n' + '='.repeat(width))
  }

  /**
   * Render a metric row
   */
  private renderMetric(label: string, value: string, indicator: string): void {
    const padding = ' '.repeat(Math.max(0, 20 - label.length))
    console.log(`  ${label}${padding}${value} ${indicator}`)
  }

  /**
   * Get health indicator based on thresholds
   */
  private getHealthIndicator(value: number, criticalThreshold: number, warningThreshold: number): string {
    if (value >= criticalThreshold) return '🔴'
    if (value >= warningThreshold) return '🟡'
    return '🟢'
  }

  /**
   * Generate HTML performance report
   */
  private generateHTMLReport(options: {
    currentData: DashboardData
    metrics: any
    cacheStats: any
    startDate: Date
    endDate: Date
  }): string {
    const { currentData, metrics, cacheStats, startDate, endDate } = options

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 {
      color: #2563eb;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px;
    }
    .card h2 {
      font-size: 18px;
      color: #1e293b;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .metric:last-child {
      border-bottom: none;
    }
    .metric-label {
      color: #64748b;
      font-size: 14px;
    }
    .metric-value {
      font-weight: 600;
      color: #1e293b;
    }
    .status-good { color: #16a34a; }
    .status-warning { color: #ea580c; }
    .status-critical { color: #dc2626; }
    .list-item {
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .list-item:last-child {
      border-bottom: none;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 13px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Performance Report</h1>
    <div class="subtitle">
      Generated: ${new Date().toLocaleString()} | Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}
    </div>

    <div class="grid">
      <!-- System Metrics -->
      <div class="card">
        <h2>🖥️ System</h2>
        <div class="metric">
          <span class="metric-label">CPU Usage</span>
          <span class="metric-value">${currentData.system.cpuUsage.toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Memory Used</span>
          <span class="metric-value">${formatBytes(currentData.system.memoryUsed)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Memory Free</span>
          <span class="metric-value">${formatBytes(currentData.system.memoryFree)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Uptime</span>
          <span class="metric-value">${formatDuration(currentData.system.uptime * 1000)}</span>
        </div>
      </div>

      <!-- Telemetry Metrics -->
      <div class="card">
        <h2>📈 Telemetry</h2>
        <div class="metric">
          <span class="metric-label">Total Events</span>
          <span class="metric-value">${currentData.telemetry.totalEvents}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Recent Errors</span>
          <span class="metric-value ${currentData.telemetry.recentErrors.length > 0 ? 'status-warning' : 'status-good'}">
            ${currentData.telemetry.recentErrors.length}
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">Timer Events</span>
          <span class="metric-value">${metrics.timers.length}</span>
        </div>
      </div>

      <!-- Cache Metrics -->
      <div class="card">
        <h2>💾 Cache</h2>
        <div class="metric">
          <span class="metric-label">Hit Rate</span>
          <span class="metric-value">${cacheStats.hits + cacheStats.misses > 0 ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1) : 0}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Hits</span>
          <span class="metric-value">${cacheStats.hits}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Misses</span>
          <span class="metric-value">${cacheStats.misses}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Entries</span>
          <span class="metric-value">${cacheStats.entryCount}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Size</span>
          <span class="metric-value">${formatBytes(cacheStats.totalSize)}</span>
        </div>
      </div>

      <!-- Script Metrics -->
      <div class="card">
        <h2>⚡ Scripts</h2>
        <div class="metric">
          <span class="metric-label">Total Executions</span>
          <span class="metric-value">${currentData.scripts.totalExecutions}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Avg Duration</span>
          <span class="metric-value">${formatDuration(currentData.scripts.averageDuration)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Failure Rate</span>
          <span class="metric-value ${currentData.scripts.failureRate > 0.1 ? 'status-warning' : 'status-good'}">
            ${(currentData.scripts.failureRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>

    ${currentData.scripts.topScripts.length > 0 ? `
    <div class="card">
      <h2>🏆 Top Scripts</h2>
      ${currentData.scripts.topScripts.map((script) => `
        <div class="list-item">
          <strong>${script.name}</strong>: ${script.count} executions
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${currentData.telemetry.recentErrors.length > 0 ? `
    <div class="card" style="margin-top: 20px;">
      <h2>⚠️ Recent Errors</h2>
      ${currentData.telemetry.recentErrors.slice(0, 10).map((error) => `
        <div class="list-item">
          <strong>${error.name}</strong><br>
          <span style="color: #64748b; font-size: 13px;">${error.message}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <footer>
      Generated by RevealUI Performance Dashboard | ${new Date().toLocaleString()}
    </footer>
  </div>
</body>
</html>`
  }
}

// Run CLI
const cli = new DashboardCLI()
const exitCode = await cli.run()
process.exit(exitCode)
