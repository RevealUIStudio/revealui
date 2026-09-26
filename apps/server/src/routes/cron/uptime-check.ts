/**
 * Uptime Monitoring Cron
 *
 * Invoked by the daily dispatcher as POST /uptime-check with X-Cron-Secret,
 * and directly as GET or POST /api/cron/uptime-check. Records health check
 * results to the audit log for SLA tracking and SOC2 compliance (Availability TSC).
 *
 * SLA calculation: count(status=ok) / count(*) over a rolling 30-day window.
 */

import { healthCheck } from '@revealui/core/observability';
import { logger } from '@revealui/core/observability/logger';
import { AuditWriteError, classifyAuditWriteFailure } from '@revealui/core/security';
import { Hono } from 'hono';
import { revealuiCronSecretMatches, vercelCronSecretMatches } from '../../lib/cron-auth.js';

const app = new Hono();

const BEARER_PREFIX = 'Bearer ';

function cronSecretsConfigured(): boolean {
  return Boolean(
    process.env.REVEALUI_CRON_SECRET?.trim() ||
      process.env.REVEALUI_CRON_SECRET_PREVIOUS?.trim() ||
      process.env.CRON_SECRET?.trim() ||
      process.env.CRON_SECRET_PREVIOUS?.trim(),
  );
}

function authorizeUptimeCheck(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  // Dispatch fan-out sends X-Cron-Secret (current REVEALUI_CRON_SECRET).
  // Direct calls may also send Authorization: Bearer CRON_SECRET.
  // Fail-open only when none of the four cron secret vars are set.
  const headerSecret = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  const authorization = c.req.header('Authorization') || c.req.header('authorization');
  const bearerToken = authorization?.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : undefined;
  const authorized =
    revealuiCronSecretMatches(headerSecret) || vercelCronSecretMatches(bearerToken);
  if (!cronSecretsConfigured()) return true;
  return authorized;
}

// Path and methods match dispatch.ts fan-out: POST http://localhost/uptime-check.
app.on(['GET', 'POST'], '/uptime-check', async (c) => {
  if (!authorizeUptimeCheck(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const start = Date.now();
  const health = await healthCheck.checkHealth();
  const duration = Date.now() - start;

  const result = {
    status: health.status,
    checks: health.checks,
    uptime: health.uptime,
    responseTimeMs: duration,
    timestamp: new Date().toISOString(),
  };

  // Log to structured output for external monitoring (Vercel Logs, Datadog, etc.)
  logger.info('[uptime-check]', result);

  // Record to audit log for SLA tracking
  try {
    const { audit } = await import('@revealui/core/security');
    await audit.log({
      type: 'security.alert',
      severity: health.status === 'healthy' ? 'low' : 'high',
      actor: { id: 'system:uptime-cron', type: 'system' },
      action: 'uptime_check',
      result: health.status === 'healthy' ? 'success' : 'failure',
      metadata: {
        healthStatus: health.status,
        responseTimeMs: duration,
        checks: health.checks,
        uptimeSeconds: health.uptime,
      },
    });
  } catch (err) {
    // Audit write failed (or the write path itself threw before reaching
    // storage). Health check data is still on stdout above, but a failed
    // SLA-tracking write must not vanish silently.
    const cause = err instanceof AuditWriteError ? err.cause : err;
    logger.warn('Uptime-check audit write failed', {
      eventId: err instanceof AuditWriteError ? err.event.id : undefined,
      eventType: err instanceof AuditWriteError ? err.event.type : undefined,
      reason: classifyAuditWriteFailure(cause),
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }

  return c.json(result, health.status === 'healthy' ? 200 : 503);
});

export default app;
