/**
 * Alert System
 *
 * Manages alert channels (logger, Sentry, console) and alert delivery.
 * Provides configurable thresholds and aggregation for production.
 */

import type { Alert, AlertLevel } from './types'
import { logger } from '../utils/logger'

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

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config }

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
    const logData = {
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      timestamp: alert.timestamp,
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

    try {
      // Check if Sentry is available
      // Using dynamic import to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require('@sentry/node')

      Sentry.captureMessage(alert.message, {
        level: 'error',
        tags: {
          metric: alert.metric,
          alert_level: alert.level,
        },
        extra: {
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.timestamp,
        },
      })
    } catch (error) {
      // Sentry not available, ignore
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
    for (const [key, alerts] of Array.from(grouped.entries())) {
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
