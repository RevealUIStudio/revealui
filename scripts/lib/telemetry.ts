/**
 * Telemetry and monitoring utilities.
 *
 * Provides comprehensive metrics collection and performance monitoring:
 * - Script execution tracking
 * - Error tracking and analytics
 * - Cache performance metrics
 * - Script usage statistics
 * - Performance measurement
 * - Persistent metric storage
 *
 * @example
 * ```typescript
 * import { telemetry } from './telemetry.js'
 *
 * // Track script execution
 * const timer = telemetry.startTimer('build')
 * // ... build process ...
 * timer.stop()
 *
 * // Track errors
 * telemetry.trackError('build-failed', error)
 *
 * // Get metrics
 * const metrics = await telemetry.getMetrics()
 * console.log(`Cache hit rate: ${metrics.cacheHitRate}%`)
 * ```
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileExists, formatDuration, formatBytes } from './utils.js'
import { getProjectRoot } from './paths.js'
import { createLogger } from './logger.js'

const logger = createLogger({ prefix: 'Telemetry' })

// =============================================================================
// Types
// =============================================================================

export interface MetricEvent {
  /** Event name */
  name: string
  /** Event type */
  type: 'counter' | 'timer' | 'gauge' | 'error'
  /** Event value */
  value: number
  /** Timestamp */
  timestamp: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export interface TimerHandle {
  /** Stop the timer and record duration */
  stop: (metadata?: Record<string, unknown>) => number
  /** Get elapsed time without stopping */
  elapsed: () => number
}

export interface AggregatedMetrics {
  /** Total events */
  totalEvents: number
  /** Events by type */
  eventsByType: Record<string, number>
  /** Script execution stats */
  scripts: {
    totalExecutions: number
    averageDuration: number
    slowest: Array<{ name: string; duration: number }>
    fastest: Array<{ name: string; duration: number }>
    failures: number
  }
  /** Cache performance */
  cache: {
    hits: number
    misses: number
    hitRate: number
    totalSize: number
    formattedSize: string
  }
  /** Error tracking */
  errors: {
    total: number
    byType: Record<string, number>
    recent: Array<{ name: string; timestamp: number; message?: string }>
  }
  /** Performance metrics */
  performance: {
    averageScriptDuration: number
    totalDuration: number
    formattedTotalDuration: string
  }
  /** Time period */
  period: {
    start: number
    end: number
    duration: number
  }
}

export interface TelemetryOptions {
  /** Storage directory for metrics */
  storageDir?: string
  /** Enable persistent storage */
  persistent?: boolean
  /** Auto-flush interval in ms (0 = disabled) */
  autoFlushInterval?: number
  /** Maximum events in memory before flush */
  maxEventsInMemory?: number
  /** Enable verbose logging */
  verbose?: boolean
}

// =============================================================================
// Telemetry Class
// =============================================================================

export class Telemetry {
  private events: MetricEvent[] = []
  private storageDir: string
  private persistent: boolean
  private autoFlushInterval: number
  private maxEventsInMemory: number
  private verbose: boolean
  private timers: Map<string, number> = new Map()
  private flushTimer: NodeJS.Timeout | null = null
  private projectRoot: string | null = null

  constructor(options: TelemetryOptions = {}) {
    this.storageDir = options.storageDir ?? '.telemetry'
    this.persistent = options.persistent ?? true
    this.autoFlushInterval = options.autoFlushInterval ?? 60_000 // 1 minute
    this.maxEventsInMemory = options.maxEventsInMemory ?? 1000
    this.verbose = options.verbose ?? false

    // Start auto-flush if enabled
    if (this.autoFlushInterval > 0 && this.persistent) {
      this.startAutoFlush()
    }
  }

  /**
   * Get project root directory.
   */
  private async getRoot(): Promise<string> {
    if (!this.projectRoot) {
      this.projectRoot = await getProjectRoot(import.meta.url)
    }
    return this.projectRoot
  }

  /**
   * Get storage directory path.
   */
  private async getStorageDir(): Promise<string> {
    const root = await this.getRoot()
    return join(root, this.storageDir)
  }

  /**
   * Get metrics file path for a given date.
   */
  private async getMetricsFilePath(date: Date = new Date()): Promise<string> {
    const dir = await this.getStorageDir()
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    return join(dir, `metrics-${dateStr}.json`)
  }

  /**
   * Start auto-flush timer.
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      return
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        logger.warn(`Auto-flush failed: ${error.message}`)
      })
    }, this.autoFlushInterval)

    // Cleanup on process exit
    process.on('beforeExit', () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer)
      }
      this.flush().catch(() => {
        // Ignore flush errors on exit
      })
    })
  }

  /**
   * Record a metric event.
   */
  private record(event: MetricEvent): void {
    this.events.push(event)

    if (this.verbose) {
      logger.info(`[${event.type}] ${event.name}: ${event.value}`)
    }

    // Auto-flush if we hit the memory limit
    if (this.events.length >= this.maxEventsInMemory && this.persistent) {
      this.flush().catch((error) => {
        logger.warn(`Auto-flush failed: ${error.message}`)
      })
    }
  }

  /**
   * Increment a counter.
   */
  counter(name: string, value: number = 1, metadata?: Record<string, unknown>): void {
    this.record({
      name,
      type: 'counter',
      value,
      timestamp: Date.now(),
      metadata,
    })
  }

  /**
   * Start a timer.
   */
  startTimer(name: string, metadata?: Record<string, unknown>): TimerHandle {
    const startTime = Date.now()
    const timerId = `${name}-${startTime}`
    this.timers.set(timerId, startTime)

    return {
      stop: (additionalMetadata?: Record<string, unknown>) => {
        const endTime = Date.now()
        const duration = endTime - startTime
        this.timers.delete(timerId)

        this.record({
          name,
          type: 'timer',
          value: duration,
          timestamp: endTime,
          metadata: { ...metadata, ...additionalMetadata },
        })

        return duration
      },
      elapsed: () => {
        return Date.now() - startTime
      },
    }
  }

  /**
   * Record a gauge value.
   */
  gauge(name: string, value: number, metadata?: Record<string, unknown>): void {
    this.record({
      name,
      type: 'gauge',
      value,
      timestamp: Date.now(),
      metadata,
    })
  }

  /**
   * Track an error.
   */
  trackError(
    name: string,
    error: Error | string,
    metadata?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error

    this.record({
      name,
      type: 'error',
      value: 1,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
    })
  }

  /**
   * Flush events to persistent storage.
   */
  async flush(): Promise<void> {
    if (!this.persistent || this.events.length === 0) {
      return
    }

    const dir = await this.getStorageDir()
    await mkdir(dir, { recursive: true })

    const filePath = await this.getMetricsFilePath()
    const eventsToFlush = [...this.events]
    this.events = []

    try {
      // Load existing events for today
      let existingEvents: MetricEvent[] = []
      if (await fileExists(filePath)) {
        const content = await readFile(filePath, 'utf-8')
        existingEvents = JSON.parse(content)
      }

      // Append new events
      const allEvents = [...existingEvents, ...eventsToFlush]

      // Write back
      await writeFile(filePath, JSON.stringify(allEvents, null, 2))

      if (this.verbose) {
        logger.info(`Flushed ${eventsToFlush.length} events to ${filePath}`)
      }
    } catch (error) {
      logger.error(`Failed to flush events: ${error}`)
      // Put events back in memory
      this.events.unshift(...eventsToFlush)
      throw error
    }
  }

  /**
   * Load events from storage.
   */
  async loadEvents(
    startDate?: Date,
    endDate: Date = new Date()
  ): Promise<MetricEvent[]> {
    const dir = await this.getStorageDir()

    if (!(await fileExists(dir))) {
      return []
    }

    const allEvents: MetricEvent[] = []
    const start = startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // Default: last 7 days

    // Iterate through each day
    const currentDate = new Date(start)
    while (currentDate <= endDate) {
      const filePath = await this.getMetricsFilePath(currentDate)

      if (await fileExists(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8')
          const events: MetricEvent[] = JSON.parse(content)
          allEvents.push(...events)
        } catch (error) {
          logger.warn(`Failed to load metrics from ${filePath}: ${error}`)
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return allEvents
  }

  /**
   * Get aggregated metrics.
   */
  async getMetrics(
    startDate?: Date,
    endDate: Date = new Date()
  ): Promise<AggregatedMetrics> {
    // Flush current events first
    if (this.persistent) {
      await this.flush()
    }

    // Load events from storage
    const events = await this.loadEvents(startDate, endDate)

    // Include in-memory events
    const allEvents = [...events, ...this.events]

    // Aggregate metrics
    const eventsByType: Record<string, number> = {}
    const scriptExecutions: Array<{ name: string; duration: number }> = []
    let cacheHits = 0
    let cacheMisses = 0
    let totalCacheSize = 0
    const errorsByType: Record<string, number> = {}
    const recentErrors: Array<{ name: string; timestamp: number; message?: string }> =
      []
    let totalDuration = 0

    for (const event of allEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1

      if (event.type === 'timer') {
        scriptExecutions.push({ name: event.name, duration: event.value })
        totalDuration += event.value
      } else if (event.type === 'counter') {
        if (event.name.includes('cache-hit')) {
          cacheHits += event.value
        } else if (event.name.includes('cache-miss')) {
          cacheMisses += event.value
        }
      } else if (event.type === 'gauge' && event.name.includes('cache-size')) {
        totalCacheSize = event.value
      } else if (event.type === 'error') {
        errorsByType[event.name] = (errorsByType[event.name] || 0) + 1
        recentErrors.push({
          name: event.name,
          timestamp: event.timestamp,
          message: event.metadata?.message as string | undefined,
        })
      }
    }

    // Sort executions by duration
    scriptExecutions.sort((a, b) => b.duration - a.duration)

    // Calculate averages
    const averageDuration =
      scriptExecutions.length > 0
        ? totalDuration / scriptExecutions.length
        : 0

    // Get slowest and fastest
    const slowest = scriptExecutions.slice(0, 5)
    const fastest = scriptExecutions.slice(-5).reverse()

    // Calculate cache hit rate
    const totalCacheRequests = cacheHits + cacheMisses
    const cacheHitRate =
      totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0

    // Sort recent errors by timestamp
    recentErrors.sort((a, b) => b.timestamp - a.timestamp)

    return {
      totalEvents: allEvents.length,
      eventsByType,
      scripts: {
        totalExecutions: scriptExecutions.length,
        averageDuration,
        slowest,
        fastest,
        failures: errorsByType['script-failed'] || 0,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: Math.round(cacheHitRate * 100) / 100,
        totalSize: totalCacheSize,
        formattedSize: formatBytes(totalCacheSize),
      },
      errors: {
        total: recentErrors.length,
        byType: errorsByType,
        recent: recentErrors.slice(0, 10),
      },
      performance: {
        averageScriptDuration: averageDuration,
        totalDuration,
        formattedTotalDuration: formatDuration(totalDuration),
      },
      period: {
        start: startDate?.getTime() || allEvents[0]?.timestamp || Date.now(),
        end: endDate.getTime(),
        duration: endDate.getTime() - (startDate?.getTime() || allEvents[0]?.timestamp || Date.now()),
      },
    }
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.events = []
    this.timers.clear()
  }

  /**
   * Stop telemetry and cleanup.
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    if (this.persistent) {
      await this.flush()
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalTelemetry: Telemetry | null = null

/**
 * Get the global telemetry instance.
 */
export function getTelemetry(): Telemetry {
  if (!globalTelemetry) {
    globalTelemetry = new Telemetry({
      persistent: true,
      autoFlushInterval: 60_000, // 1 minute
      verbose: false,
    })
  }
  return globalTelemetry
}

/**
 * Global telemetry instance.
 */
export const telemetry = getTelemetry()

/**
 * Create a new telemetry instance.
 */
export function createTelemetry(options?: TelemetryOptions): Telemetry {
  return new Telemetry(options)
}
