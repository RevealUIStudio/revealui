/**
 * Health Monitoring API Endpoint
 *
 * Returns comprehensive system health metrics including:
 * - System resources (memory, CPU, uptime)
 * - Process statistics (active, zombies, failed, spawn rate)
 * - Database pool metrics
 * - Recent zombie processes
 * - Active alerts
 *
 * Status codes:
 * - 200: Healthy (no alerts)
 * - 206: Degraded (warnings present)
 * - 503: Unhealthy (critical alerts)
 */

import crypto from 'node:crypto';
import config from '@revealui/config';
import {
  getHealthMetrics,
  getHealthStatus,
  type HealthMetrics,
  sendAlerts,
} from '@revealui/core/monitoring';
import { getPoolMetrics } from '@revealui/db/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health-monitoring
 *
 * Returns comprehensive health metrics
 */
export async function GET(
  request: Request,
): Promise<NextResponse<HealthMetrics | { error: string }>> {
  const token = request.headers.get('x-internal-token');
  const secret = config.reveal.secret;
  if (
    !(secret && token) ||
    token.length !== secret.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get database pool metrics
    const poolMetrics = getPoolMetrics();

    // Separate by database type (assuming naming convention: rest-*, vector-*)
    const restPools = poolMetrics.filter((p) => p.name.startsWith('pool-'));
    const vectorPools = poolMetrics.filter((p) => p.name.startsWith('vector-'));

    // Get health metrics
    const metrics = getHealthMetrics({
      rest: restPools,
      vector: vectorPools,
    });

    // Send alerts through alert system
    if (metrics.alerts.length > 0) {
      sendAlerts(metrics.alerts);
    }

    // Determine status code based on alerts
    const { statusCode } = getHealthStatus(metrics.alerts);

    return NextResponse.json(metrics, { status: statusCode });
  } catch (error) {
    // Return error response
    const errorMetrics: HealthMetrics = {
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0,
        platform: process.platform,
        nodeVersion: process.version,
      },
      processes: {
        active: 0,
        zombies: 0,
        failed: 0,
        spawnRate: 0,
        bySource: {
          exec: 0,
          orchestration: 0,
          mcp: 0,
          'ai-runtime': 0,
          'dev-server': 0,
          database: 0,
          unknown: 0,
        },
      },
      database: {
        rest: [],
        vector: [],
      },
      recentZombies: [],
      alerts: [
        {
          level: 'critical',
          metric: 'memory',
          message: `Health monitoring error: ${error instanceof Error ? error.message : String(error)}`,
          value: 0,
          threshold: 0,
          timestamp: Date.now(),
        },
      ],
      timestamp: Date.now(),
    };

    return NextResponse.json(errorMetrics, { status: 503 });
  }
}
