import type { ProcessSource, ProcessStatus } from '@revealui/core/monitoring'
import { processRegistry } from '@revealui/core/monitoring'
import { logger } from '@revealui/core/observability/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/health-monitoring/processes
 *
 * Returns list of tracked processes with optional filtering
 *
 * Query parameters:
 * - status: Filter by process status (running, completed, failed, zombie, killed)
 * - source: Filter by process source (exec, mcp, orchestration, ai-runtime, dev-server)
 * - limit: Maximum number of processes to return (default: 50, max: 200)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as ProcessStatus | null
    const source = searchParams.get('source') as ProcessSource | null
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50

    // Get all processes
    let processes = processRegistry.getAll()

    // Apply filters
    if (status) {
      processes = processes.filter((p) => p.status === status)
    }
    if (source) {
      processes = processes.filter((p) => p.source === source)
    }

    // Sort by start time (most recent first)
    processes.sort((a, b) => b.startTime - a.startTime)

    // Apply limit
    processes = processes.slice(0, limit)

    return NextResponse.json(
      {
        processes,
        total: processes.length,
        filters: {
          status: status || 'all',
          source: source || 'all',
          limit,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    )
  } catch (error) {
    logger.error(
      'Error fetching processes',
      error instanceof Error ? error : new Error(String(error)),
    )
    return NextResponse.json(
      {
        error: 'Failed to fetch processes',
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
