import { getHealthMetrics } from '@revealui/core/monitoring'
import { getPoolMetrics } from '@revealui/db/core'
import { logger } from '@revealui/core/observability/logger'
import { NextResponse } from 'next/server'

/**
 * GET /api/health-monitoring
 *
 * Returns comprehensive system health metrics including:
 * - System stats (memory, CPU, uptime)
 * - Process statistics
 * - Database pool metrics
 * - Active alerts
 * - Recent zombie processes
 */
export async function GET() {
  try {
    // Get database pool metrics
    const allPools = getPoolMetrics()

    // Separate pools by type (based on naming convention)
    const restPools = allPools.filter(
      (pool) => pool.name.includes('rest') || !pool.name.includes('vector'),
    )
    const vectorPools = allPools.filter((pool) => pool.name.includes('vector'))

    // Get comprehensive health metrics
    const metrics = getHealthMetrics({
      rest: restPools,
      vector: vectorPools,
    })

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Error fetching health metrics', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      {
        error: 'Failed to fetch health metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
      },
    )
  }
}

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'
