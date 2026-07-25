/**
 * SecurityAlertService bridge (fleet-redundancy C11).
 *
 * Lazy singleton: evaluates auth/security audit events against DEFAULT_THRESHOLDS
 * and logs via LogAlertHandler. Best-effort — never throws into the login path.
 */

import { logger } from '@revealui/core/observability/logger';
import type { SecurityAlertService } from '@revealui/security';
// AuditEvent lives on the server subpath (node:crypto audit module); not on the client-safe barrel.
import type { AuditEvent } from '@revealui/security/server';

type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'>;

let service: SecurityAlertService | null | undefined;

/**
 * Lazily construct the process-wide SecurityAlertService, or null if the
 * security package cannot be loaded (e.g. partial test mocks).
 */
async function getAlertService(): Promise<SecurityAlertService | null> {
  if (service !== undefined) {
    return service;
  }
  try {
    const {
      SecurityAlertService: AlertService,
      DEFAULT_THRESHOLDS,
      LogAlertHandler,
    } = await import('@revealui/security');
    service = new AlertService({
      thresholds: DEFAULT_THRESHOLDS,
      handlers: [new LogAlertHandler()],
    });
    return service;
  } catch {
    service = null;
    return null;
  }
}

/** Reset singleton (tests only). */
export function resetSecurityAlertService(): void {
  service = undefined;
}

/**
 * Feed an audit-shaped event into SecurityAlertService.evaluateEvent.
 * Never throws; failures are logged and swallowed.
 */
export async function evaluateSecurityAlert(event: AuditEventInput): Promise<void> {
  try {
    const alerts = await getAlertService();
    if (!alerts) return;
    const full: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    await alerts.evaluateEvent(full);
  } catch (error) {
    logger.error('Failed to evaluate security alert', error instanceof Error ? error : undefined, {
      type: event.type,
    });
  }
}
