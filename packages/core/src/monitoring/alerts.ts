/**
 * Alert System
 *
 * Manages alert channels (logger, Sentry, console) and alert delivery.
 * Provides configurable thresholds and aggregation for production.
 */

import { logger } from '../utils/logger-server.js'
import { getRequestContext } from '../utils/request-context.js'
import type { Alert } from './types.js'

/**
 * Sentry interface for dependency injection and testing
 */
interface SentryClient {
  captureMessage: (message: string, context?: unknown) => void
  setUser: (user: unknown) => void
}

/**
 * Get Sentry client if available
 * Using dynamic import with string variable to avoid build-time resolution
 */
async function getSentryClient(): Promise<SentryClient | null> {
  try {
    // Use string variable to prevent static analysis and bundler resolution
    const moduleName = '@sentry' + '/node'
    // @ts-expect-error - Sentry may not be installed
    const sentry = await import(/* webpackIgnore: true */ moduleName)
    return sentry as unknown as SentryClient
  } catch {
    return null
  }
}

/**
 * Synchronous version that caches the client
 */
let sentryClientCache: SentryClient | null | undefined
function getSentryClientSync(): SentryClient | null {
  if (sentryClientCache !== undefined) {
    return sentryClientCache
  }

  // Initialize asynchronously in the background
  getSentryClient()
    .then((client) => {
      sentryClientCache = client
    })
    .catch(() => {
      sentryClientCache = null
    })

  return null
}

/**
 * Alert channel type
 */
type AlertChannel = 'logger' | 'sentry' | 'console'

/**
 * Alert configuration
 */
interface AlertConfig {
  /** Enabled channels */
  channels: AlertChannel[]

  /** Aggregate alerts in production (log every N minutes instead of immediately) */
  aggregateInProduction: boolean

  /** Aggregation interval in milliseconds */
  aggregationInterval: number

  /** Enable Sentry in production only */
  sentryProductionOnly: boolean
}

/**
 * Default alert configuration
 */
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  channels: ['logger', 'console'],
  aggregateInProduction: true,
  aggregationInterval: 5 * 60 * 1000, // 5 minutes
  sentryProductionOnly: true,
}

/**
 * Alert manager class
 */
class AlertManager {
  private config: AlertConfig
  private alertQueue: Alert[] = []
  private aggregationTimer: NodeJS.Timeout | null = null
  private lastAggregationTime = 0
  private sentryClient: SentryClient | null = null

  constructor(config: Partial<AlertConfig> = {}, sentryClient?: SentryClient | null) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config }
    this.sentryClient = sentryClient !== undefined ? sentryClient : getSentryClientSync()

    // Start aggregation timer if enabled
    if (this.config.aggregateInProduction && this.isProduction()) {
      this.startAggregation()
    }
  }

  /**
   * Send an alert through configured channels
   */
  sendAlert(alert: Alert): void {
    if (this.config.aggregateInProduction && this.isProduction()) {
      // In production, queue alerts for aggregation
      this.alertQueue.push(alert)
    } else {
      // In development, send immediately
      this.deliverAlert(alert)
    }
  }

  /**
   * Send multiple alerts
   */
  sendAlerts(alerts: Alert[]): void {
    for (const alert of alerts) {
      this.sendAlert(alert)
    }
  }

  /**
   * Deliver an alert to configured channels
   */
  private deliverAlert(alert: Alert): void {
    for (const channel of this.config.channels) {
      switch (channel) {
        case 'logger':
          this.sendToLogger(alert)
          break

        case 'console':
          this.sendToConsole(alert)
          break

        case 'sentry':
          if (!this.config.sentryProductionOnly || this.isProduction()) {
            this.sendToSentry(alert)
          }
          break
      }
    }
  }

  /**
   * Send alert to logger
   */
  private sendToLogger(alert: Alert): void {
    // Get request context for additional metadata
    const context = getRequestContext()

    const logData = {
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.timestamp,
      // Include request context if available
      ...(context?.userId && { userId: context.userId }),
      ...(context?.path && { path: context.path }),
      ...(context?.method && { method: context.method }),
      ...(context?.ip && { ip: context.ip }),
    }

    if (alert.level === 'critical') {
      logger.error(alert.message, logData)
    } else {
      logger.warn(alert.message, logData)
    }
  }

  /**
   * Send alert to console
   */
  private sendToConsole(alert: Alert): void {
    const prefix = alert.level === 'critical' ? '🔴 CRITICAL' : '⚠️  WARNING'
    const timestamp = new Date(alert.timestamp).toISOString()

    console.log(`[${timestamp}] ${prefix}: ${alert.message}`)
  }

  /**
   * Send alert to Sentry
   */
  private sendToSentry(alert: Alert): void {
    // Only send critical alerts to Sentry
    if (alert.level !== 'critical') return

    // Check if Sentry is available
    if (!this.sentryClient) {
      logger.debug('Sentry not available for alert delivery')
      return
    }

    try {
      // Get request context for rich tracing
      const context = getRequestContext()

      // Build tags (indexed, searchable fields)
      const tags: Record<string, string> = {
        metric: alert.metric,
        alert_level: alert.level,
      }

      // Add request context to tags for better filtering
      if (context?.requestId) tags.request_id = context.requestId
      if (context?.userId) tags.user_id = context.userId
      if (context?.path) tags.path = context.path
      if (context?.method) tags.method = context.method

      // Build extra context (non-indexed, rich data)
      const extra: Record<string, unknown> = {
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp,
      }

      // Add full request context for debugging
      if (context) {
        extra.request_context = {
          requestId: context.requestId,
          startTime: context.startTime,
          duration: Date.now() - context.startTime,
          userId: context.userId,
          path: context.path,
          method: context.method,
          ip: context.ip,
          userAgent: context.userAgent,
        }
      }

      // Set user context if available (for Sentry user tracking)
      if (context?.userId) {
        this.sentryClient.setUser({
          id: context.userId,
          ip_address: context.ip,
        })
      }

      // Capture the alert as a Sentry event
      this.sentryClient.captureMessage(alert.message, {
        level: 'error',
        tags,
        extra,
      })
    } catch (error) {
      // Sentry error, log and continue
      logger.debug('Sentry not available for alert delivery', { error })
    }
  }

  /**
   * Start aggregation timer
   */
  private startAggregation(): void {
    if (this.aggregationTimer) return

    this.aggregationTimer = setInterval(() => {
      this.flushAlerts()
    }, this.config.aggregationInterval)

    // Don't keep process alive
    this.aggregationTimer.unref()

    this.lastAggregationTime = Date.now()
  }

  /**
   * Flush aggregated alerts
   */
  private flushAlerts(): void {
    if (this.alertQueue.length === 0) return

    // Group alerts by metric and level
    const grouped = new Map<string, Alert[]>()

    for (const alert of this.alertQueue) {
      const key = `${alert.metric}:${alert.level}`
      const existing = grouped.get(key) || []
      existing.push(alert)
      grouped.set(key, existing)
    }

    // Send aggregated alerts
    for (const [_key, alerts] of Array.from(grouped.entries())) {
      if (alerts.length === 0) continue

      const first = alerts[0]
      if (!first) continue

      const count = alerts.length
      const avgValue = alerts.reduce((sum, a) => sum + a.value, 0) / count

      const aggregatedAlert: Alert = {
        level: first.level,
        metric: first.metric,
        value: first.value,
        threshold: first.threshold,
        message: `${first.message} (occurred ${count} times, avg value: ${Math.round(avgValue)})`,
        timestamp: Date.now(),
      }

      this.deliverAlert(aggregatedAlert)
    }

    // Clear queue
    this.alertQueue = []
    this.lastAggregationTime = Date.now()
  }

  /**
   * Stop aggregation timer
   */
  stopAggregation(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer)
      this.aggregationTimer = null
    }
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  }

  /**
   * Get alert queue stats
   */
  getStats(): {
    queueSize: number
    lastAggregationTime: number
    aggregationEnabled: boolean
  } {
    return {
      queueSize: this.alertQueue.length,
      lastAggregationTime: this.lastAggregationTime,
      aggregationEnabled: this.config.aggregateInProduction && this.isProduction(),
    }
  }

  /**
   * Configure alert channels
   */
  setChannels(channels: AlertChannel[]): void {
    this.config.channels = channels
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAggregation()
    this.flushAlerts() // Flush remaining alerts
  }
}

/**
 * Singleton instance
 */
export const alertManager = new AlertManager()

/**
 * Export AlertManager class for testing
 */
export { AlertManager }

/**
 * Export types for testing
 */
export type { AlertChannel, SentryClient }

/**
 * Convenience functions
 */

export function sendAlert(alert: Alert): void {
  alertManager.sendAlert(alert)
}

export function sendAlerts(alerts: Alert[]): void {
  alertManager.sendAlerts(alerts)
}

export function getAlertStats(): ReturnType<typeof alertManager.getStats> {
  return alertManager.getStats()
}

export function setAlertChannels(channels: AlertChannel[]): void {
  alertManager.setChannels(channels)
}
