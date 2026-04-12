/**
 * Uptime Monitoring Cron
 *
 * Runs every 5 minutes via Vercel Cron. Records health check results
 * to the audit log for SLA tracking and SOC2 compliance (Availability TSC).
 *
 * SLA calculation: count(status=ok) / count(*) over a rolling 30-day window.
 */

import { healthCheck } from '@revealui/core/observability';
import { logger } from '@revealui/core/observability/logger';
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  // Verify cron secret to prevent unauthorized invocations
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    await audit.logSecurityEvent(
      'monitoring',
      health.status === 'healthy' ? 'low' : 'high',
      'system:uptime-cron',
      `Health check: ${health.status} (${duration}ms)`,
      {
        healthStatus: health.status,
        responseTimeMs: duration,
        checks: health.checks,
        uptimeSeconds: health.uptime,
      },
    );
  } catch {
    // Audit system unavailable; health check data still logged to stdout
  }

  return c.json(result, health.status === 'healthy' ? 200 : 503);
});

export default app;
