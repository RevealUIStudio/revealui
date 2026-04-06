/**
 * Security Alerting Service
 *
 * Evaluates audit events against configurable threshold rules and
 * dispatches alerts through pluggable handlers (logging, audit trail,
 * webhook / SIEM integration).
 */

import type { AuditEvent, AuditSeverity } from './audit.js';
import { getSecurityLogger } from './logger.js';

// =============================================================================
// Types
// =============================================================================

/** A security alert produced when a threshold is breached. */
export interface SecurityAlert {
  /** Alert rule that triggered (e.g. 'failedLogins', 'accountLockout'). */
  type: string;
  /** Severity of the alert. */
  severity: AuditSeverity;
  /** Human-readable description. */
  message: string;
  /** Contextual data attached to the alert. */
  context: Record<string, unknown>;
  /** When the alert was raised (ISO-8601). */
  timestamp: string;
}

/** Handler that receives dispatched security alerts. */
export interface AlertHandler {
  /** Process a single alert. */
  handle(alert: SecurityAlert): Promise<void>;
}

/** Configuration for a single threshold rule. */
export interface ThresholdRule {
  /** Maximum event count before an alert fires. */
  maxCount: number;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
  /** Severity assigned to alerts from this rule. */
  severity: AuditSeverity;
  /** Human-readable message template — `{count}` is replaced at runtime. */
  messageTemplate: string;
}

/** Top-level configuration for the alerting service. */
export interface AlertingConfig {
  /** Threshold rules keyed by rule name. */
  thresholds: Record<string, ThresholdRule>;
  /** Handlers that receive dispatched alerts. */
  handlers: AlertHandler[];
}

// =============================================================================
// Built-in threshold rules
// =============================================================================

/** Default threshold rules aligned with SOC2 6.2 requirements. */
export const DEFAULT_THRESHOLDS: Record<string, ThresholdRule> = {
  failedLogins: {
    maxCount: 10,
    windowMs: 15 * 60 * 1000,
    severity: 'high',
    messageTemplate: 'Excessive failed logins detected: {count} attempts in 15 minutes',
  },
  privilegeEscalation: {
    maxCount: 1,
    windowMs: 60 * 60 * 1000,
    severity: 'critical',
    messageTemplate: 'Privilege escalation detected: role changed to admin',
  },
  massDataExport: {
    maxCount: 100,
    windowMs: 60 * 60 * 1000,
    severity: 'high',
    messageTemplate: 'Mass data export detected: {count} exports in 1 hour',
  },
  accountLockout: {
    maxCount: 1,
    windowMs: 60 * 60 * 1000,
    severity: 'high',
    messageTemplate: 'Account lockout triggered',
  },
  mfaDisabled: {
    maxCount: 1,
    windowMs: 60 * 60 * 1000,
    severity: 'critical',
    messageTemplate: 'MFA disabled on account',
  },
};

// =============================================================================
// Built-in alert handlers
// =============================================================================

/**
 * Logs alerts to the structured security logger.
 */
export class LogAlertHandler implements AlertHandler {
  /** Write alert details to the configured security logger. */
  async handle(alert: SecurityAlert): Promise<void> {
    const logger = getSecurityLogger();
    const prefix = `[SecurityAlert:${alert.type}]`;

    if (alert.severity === 'critical') {
      logger.error(`${prefix} ${alert.message}`, alert.context);
    } else {
      logger.warn(`${prefix} ${alert.message}`, alert.context);
    }
  }
}

/**
 * Writes alerts as critical audit events into the audit log.
 */
export class AuditAlertHandler implements AlertHandler {
  /** Record the alert in the audit trail with severity 'critical'. */
  async handle(alert: SecurityAlert): Promise<void> {
    try {
      const { audit } = await import('./audit.js');
      await audit.logSecurityEvent(
        'alert',
        'critical',
        (alert.context.actorId as string) ?? 'system',
        alert.message,
        { alertType: alert.type, ...alert.context },
      );
    } catch {
      // If audit system is unavailable, silently skip
    }
  }
}

/**
 * POSTs alerts to a configurable webhook URL for SIEM integration.
 */
export class WebhookAlertHandler implements AlertHandler {
  private url: string;
  private headers: Record<string, string>;

  /**
   * Create a webhook alert handler.
   *
   * @param url - The webhook endpoint URL
   * @param headers - Additional HTTP headers (e.g. authorization)
   */
  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }

  /** POST the alert payload to the configured webhook URL. */
  async handle(alert: SecurityAlert): Promise<void> {
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(alert),
      });
    } catch {
      const logger = getSecurityLogger();
      logger.error(`[WebhookAlertHandler] Failed to POST alert to ${this.url}`);
    }
  }
}

// =============================================================================
// Event-to-rule mapping
// =============================================================================

/**
 * Map an audit event to its corresponding threshold rule name.
 * Returns null if the event does not match any known rule.
 */
function mapEventToRule(event: AuditEvent): string | null {
  if (event.type === 'auth.failed_login') {
    return 'failedLogins';
  }

  if (event.type === 'role.assign') {
    const newRole = event.changes?.after?.role ?? event.metadata?.role;
    if (newRole === 'admin') {
      return 'privilegeEscalation';
    }
  }

  if (event.type === 'data.export') {
    return 'massDataExport';
  }

  if (event.action === 'account_locked') {
    return 'accountLockout';
  }

  if (event.type === 'auth.mfa_disabled') {
    return 'mfaDisabled';
  }

  return null;
}

/**
 * Derive a grouping key for sliding-window deduplication.
 * Failed logins group by email/actor; exports group globally; others by actor.
 */
function getGroupKey(event: AuditEvent, ruleName: string): string {
  if (ruleName === 'failedLogins') {
    return `${ruleName}:${event.actor.id}`;
  }
  if (ruleName === 'massDataExport') {
    return ruleName;
  }
  return `${ruleName}:${event.actor.id}`;
}

// =============================================================================
// SecurityAlertService
// =============================================================================

interface WindowEntry {
  timestamps: number[];
  lastAlertAt: number;
}

/**
 * Evaluates audit events against threshold rules and dispatches alerts.
 *
 * Maintains an in-memory sliding window per rule/group key. When the
 * event count within the window exceeds the threshold, an alert is
 * dispatched to all configured handlers.
 */
export class SecurityAlertService {
  private config: AlertingConfig;
  private windows: Map<string, WindowEntry> = new Map();

  /**
   * Create a new SecurityAlertService.
   *
   * @param config - Alerting configuration with thresholds and handlers
   */
  constructor(config: AlertingConfig) {
    this.config = config;
  }

  /**
   * Evaluate a single audit event against all threshold rules.
   * If a threshold is breached, dispatches alerts to all handlers.
   *
   * @param event - The audit event to evaluate
   * @returns The alert that was dispatched, or null if no threshold was breached
   */
  async evaluateEvent(event: AuditEvent): Promise<SecurityAlert | null> {
    const ruleName = mapEventToRule(event);
    if (!ruleName) {
      return null;
    }

    const rule = this.config.thresholds[ruleName];
    if (!rule) {
      return null;
    }

    const groupKey = getGroupKey(event, ruleName);
    const now = Date.now();
    const cutoff = now - rule.windowMs;

    // Get or create window entry
    let entry = this.windows.get(groupKey);
    if (!entry) {
      entry = { timestamps: [], lastAlertAt: 0 };
      this.windows.set(groupKey, entry);
    }

    // Add current event and prune expired entries
    entry.timestamps.push(now);
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    // Check threshold
    if (entry.timestamps.length < rule.maxCount) {
      return null;
    }

    // Prevent duplicate alerts within the same window
    if (entry.lastAlertAt > cutoff) {
      return null;
    }

    entry.lastAlertAt = now;

    const message = rule.messageTemplate.includes('{count}')
      ? rule.messageTemplate.split('{count}').join(String(entry.timestamps.length))
      : rule.messageTemplate;

    const alert: SecurityAlert = {
      type: ruleName,
      severity: rule.severity,
      message,
      context: {
        actorId: event.actor.id,
        eventType: event.type,
        count: entry.timestamps.length,
        windowMs: rule.windowMs,
      },
      timestamp: new Date(now).toISOString(),
    };

    // Dispatch to all handlers
    await this.dispatchAlert(alert);

    return alert;
  }

  /**
   * Clear all sliding window state. Useful for testing.
   */
  reset(): void {
    this.windows.clear();
  }

  /**
   * Dispatch an alert to all configured handlers.
   * Errors in individual handlers are logged but do not prevent
   * other handlers from receiving the alert.
   */
  private async dispatchAlert(alert: SecurityAlert): Promise<void> {
    const results = this.config.handlers.map(async (handler) => {
      try {
        await handler.handle(alert);
      } catch {
        const logger = getSecurityLogger();
        logger.error(`[SecurityAlertService] Handler failed for alert type=${alert.type}`);
      }
    });
    await Promise.all(results);
  }
}
