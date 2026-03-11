/**
 * Alert System
 *
 * Configure and trigger alerts based on metrics and thresholds
 */

import { logger } from './logger.js';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'firing' | 'resolved';

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  resolvedAt?: string;
  labels?: Record<string, string>;
}

export interface AlertRule {
  name: string;
  severity: AlertSeverity;
  condition: () => boolean | Promise<boolean>;
  message: string | ((context: Record<string, unknown>) => string);
  labels?: Record<string, string>;
  cooldown?: number;
  enabled?: boolean;
}

export interface AlertChannel {
  name: string;
  send: (alert: Alert) => Promise<void>;
  severities?: AlertSeverity[];
}

export class AlertingSystem {
  private rules: Map<string, AlertRule> = new Map();
  private channels: AlertChannel[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private lastFired: Map<string, number> = new Map();

  /**
   * Register alert rule
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Unregister alert rule
   */
  unregisterRule(name: string): void {
    this.rules.delete(name);
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Evaluate all rules
   */
  async evaluateRules(): Promise<void> {
    for (const [name, rule] of this.rules) {
      if (rule.enabled === false) continue;

      try {
        const shouldFire = await rule.condition();

        if (shouldFire) {
          await this.fireAlert(name, rule);
        } else {
          await this.resolveAlert(name);
        }
      } catch (error) {
        logger.error(
          'Failed to evaluate alert rule',
          error instanceof Error ? error : new Error(String(error)),
          { ruleName: name },
        );
      }
    }
  }

  /**
   * Fire an alert
   */
  private async fireAlert(ruleName: string, rule: AlertRule): Promise<void> {
    const now = Date.now();
    const lastFired = this.lastFired.get(ruleName) || 0;
    const cooldown = rule.cooldown || 0;

    // Check cooldown
    if (now - lastFired < cooldown) {
      return;
    }

    // Create or update alert
    let alert = this.activeAlerts.get(ruleName);

    if (!alert) {
      const message = typeof rule.message === 'function' ? rule.message({}) : rule.message;

      alert = {
        id: crypto.randomUUID(),
        name: ruleName,
        severity: rule.severity,
        status: 'firing',
        message,
        timestamp: new Date().toISOString(),
        labels: rule.labels,
      };

      this.activeAlerts.set(ruleName, alert);
      this.lastFired.set(ruleName, now);

      // Send to channels
      await this.sendAlert(alert);
    }
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(ruleName: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleName);

    if (alert && alert.status === 'firing') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();

      // Send resolution to channels
      await this.sendAlert(alert);

      this.activeAlerts.delete(ruleName);
    }
  }

  /**
   * Send alert to channels
   */
  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      // Check if channel handles this severity
      if (channel.severities && !channel.severities.includes(alert.severity)) {
        continue;
      }

      try {
        await channel.send(alert);
      } catch (error) {
        logger.error(
          'Failed to send alert to channel',
          error instanceof Error ? error : new Error(String(error)),
          { channelName: channel.name },
        );
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert by name
   */
  getAlert(name: string): Alert | undefined {
    return this.activeAlerts.get(name);
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.evaluateRules();
    }, intervalMs);
  }
}

/**
 * Default alerting system
 */
export const alerting = new AlertingSystem();

/**
 * Console alert channel
 */
export const consoleChannel: AlertChannel = {
  name: 'console',
  send: async (alert: Alert) => {
    const emoji =
      alert.severity === 'critical'
        ? '🔴'
        : alert.severity === 'error'
          ? '🟠'
          : alert.severity === 'warning'
            ? '🟡'
            : '🔵';

    const status = alert.status === 'firing' ? 'FIRING' : 'RESOLVED';

    const logMessage = `${emoji} [${alert.severity.toUpperCase()}] ${status}: ${alert.name}`;
    const logContext: Record<string, unknown> = {
      message: alert.message,
      details: alert.details,
    };

    if (alert.severity === 'critical' || alert.severity === 'error') {
      logger.error(logMessage, undefined, logContext);
    } else if (alert.severity === 'warning') {
      logger.warn(logMessage, logContext);
    } else {
      logger.info(logMessage, logContext);
    }

    // alert.details already included in logContext above
  },
};

/**
 * Webhook alert channel
 */
export function createWebhookChannel(url: string, severities?: AlertSeverity[]): AlertChannel {
  return {
    name: 'webhook',
    severities,
    send: async (alert: Alert) => {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });
    },
  };
}

/**
 * Email alert channel
 */
export function createEmailChannel(
  sendEmailFn: (to: string, subject: string, body: string) => Promise<void>,
  recipients: string[],
  severities?: AlertSeverity[],
): AlertChannel {
  return {
    name: 'email',
    severities,
    send: async (alert: Alert) => {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.name}`;
      const body = `
Alert: ${alert.name}
Severity: ${alert.severity}
Status: ${alert.status}
Time: ${alert.timestamp}

${alert.message}

${alert.details ? JSON.stringify(alert.details, null, 2) : ''}
      `.trim();

      for (const recipient of recipients) {
        await sendEmailFn(recipient, subject, body);
      }
    },
  };
}

/**
 * Slack alert channel
 */
export function createSlackChannel(webhookUrl: string, severities?: AlertSeverity[]): AlertChannel {
  return {
    name: 'slack',
    severities,
    send: async (alert: Alert) => {
      const color =
        alert.severity === 'critical'
          ? 'danger'
          : alert.severity === 'error'
            ? 'warning'
            : alert.severity === 'warning'
              ? '#FFA500'
              : 'good';

      const payload = {
        attachments: [
          {
            color,
            title: `${alert.status === 'firing' ? '🔔' : '✅'} ${alert.name}`,
            text: alert.message,
            fields: [
              {
                title: 'Severity',
                value: alert.severity,
                short: true,
              },
              {
                title: 'Status',
                value: alert.status,
                short: true,
              },
              {
                title: 'Time',
                value: alert.timestamp,
                short: true,
              },
            ],
            footer: 'RevealUI Monitoring',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    },
  };
}

/**
 * Common alert rules
 */

/**
 * High error rate alert
 */
export function createErrorRateAlert(getErrorRate: () => number, threshold: number = 5): AlertRule {
  return {
    name: 'high_error_rate',
    severity: 'error',
    condition: () => getErrorRate() > threshold,
    message: `Error rate (${getErrorRate()}%) exceeds threshold (${threshold}%)`,
    cooldown: 300000, // 5 minutes
  };
}

/**
 * High response time alert
 */
export function createResponseTimeAlert(getP95: () => number, threshold: number = 1000): AlertRule {
  return {
    name: 'high_response_time',
    severity: 'warning',
    condition: () => getP95() > threshold,
    message: `Response time p95 (${getP95()}ms) exceeds threshold (${threshold}ms)`,
    cooldown: 300000, // 5 minutes
  };
}

/**
 * Low cache hit rate alert
 */
export function createCacheHitRateAlert(
  getCacheHitRate: () => number,
  threshold: number = 60,
): AlertRule {
  return {
    name: 'low_cache_hit_rate',
    severity: 'warning',
    condition: () => getCacheHitRate() < threshold,
    message: `Cache hit rate (${getCacheHitRate()}%) below threshold (${threshold}%)`,
    cooldown: 600000, // 10 minutes
  };
}

/**
 * High memory usage alert
 */
export function createMemoryUsageAlert(
  getMemoryUsage: () => number,
  threshold: number = 90,
): AlertRule {
  return {
    name: 'high_memory_usage',
    severity: 'error',
    condition: () => getMemoryUsage() > threshold,
    message: `Memory usage (${getMemoryUsage()}%) exceeds threshold (${threshold}%)`,
    cooldown: 300000, // 5 minutes
  };
}

/**
 * Database connection alert
 */
export function createDatabaseAlert(checkConnection: () => Promise<boolean>): AlertRule {
  return {
    name: 'database_connection',
    severity: 'critical',
    condition: async () => !(await checkConnection()),
    message: 'Database connection lost',
    cooldown: 60000, // 1 minute
  };
}

/**
 * Service health alert
 */
export function createServiceHealthAlert(
  serviceName: string,
  checkHealth: () => Promise<boolean>,
): AlertRule {
  return {
    name: `service_health_${serviceName}`,
    severity: 'error',
    condition: async () => !(await checkHealth()),
    message: `Service ${serviceName} is unhealthy`,
    cooldown: 180000, // 3 minutes
  };
}

/**
 * Disk space alert
 */
export function createDiskSpaceAlert(
  getDiskUsage: () => number,
  threshold: number = 90,
): AlertRule {
  return {
    name: 'low_disk_space',
    severity: 'warning',
    condition: () => getDiskUsage() > threshold,
    message: `Disk usage (${getDiskUsage()}%) exceeds threshold (${threshold}%)`,
    cooldown: 3600000, // 1 hour
  };
}

/**
 * Queue size alert
 */
export function createQueueSizeAlert(
  queueName: string,
  getQueueSize: () => number,
  threshold: number = 1000,
): AlertRule {
  return {
    name: `queue_size_${queueName}`,
    severity: 'warning',
    condition: () => getQueueSize() > threshold,
    message: `Queue ${queueName} size (${getQueueSize()}) exceeds threshold (${threshold})`,
    cooldown: 300000, // 5 minutes
  };
}

/**
 * Custom metric alert
 */
export function createMetricAlert(
  name: string,
  getMetric: () => number,
  threshold: number,
  operator: '>' | '<' | '=' = '>',
  severity: AlertSeverity = 'warning',
): AlertRule {
  const condition = () => {
    const value = getMetric();

    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '=':
        return value === threshold;
      default:
        return false;
    }
  };

  return {
    name,
    severity,
    condition,
    message: () => {
      const value = getMetric();
      return `Metric ${name} (${value}) ${operator} threshold (${threshold})`;
    },
    cooldown: 300000, // 5 minutes
  };
}
