/**
 * Process List API Endpoint
 *
 * Returns list of tracked processes with filtering and sorting capabilities.
 *
 * Query parameters:
 * - status: Filter by process status (running|completed|failed|zombie|killed)
 * - source: Filter by process source (exec|orchestration|mcp|ai-runtime|dev-server|database)
 * - sort: Sort field (pid|startTime|endTime|status)
 * - order: Sort order (asc|desc)
 * - limit: Maximum number of results (default: 100)
 */

import crypto from 'node:crypto';
import config from '@revealui/config';
import {
  getAllProcesses,
  type ProcessSource,
  type ProcessStatus,
  type TrackedProcess,
} from '@revealui/core/monitoring';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Process list response
 */
interface ProcessListResponse {
  processes: TrackedProcess[];
  total: number;
  filtered: number;
}

/**
 * GET /api/health-monitoring/processes
 *
 * Returns list of tracked processes
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ProcessListResponse | { error: string }>> {
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
    const searchParams = request.nextUrl.searchParams;

    // Get query parameters
    const statusFilter = searchParams.get('status') as ProcessStatus | null;
    const sourceFilter = searchParams.get('source') as ProcessSource | null;
    const sortField = searchParams.get('sort') || 'startTime';
    const sortOrder = searchParams.get('order') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get all processes
    let processes = getAllProcesses();
    const total = processes.length;

    // Apply filters
    if (statusFilter) {
      processes = processes.filter((p) => p.status === statusFilter);
    }

    if (sourceFilter) {
      processes = processes.filter((p) => p.source === sourceFilter);
    }

    const filtered = processes.length;

    // Apply sorting
    processes.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case 'pid':
          aValue = a.pid;
          bValue = b.pid;
          break;
        case 'startTime':
          aValue = a.startTime;
          bValue = b.startTime;
          break;
        case 'endTime':
          aValue = a.endTime || 0;
          bValue = b.endTime || 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.startTime;
          bValue = b.startTime;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // Apply limit
    processes = processes.slice(0, limit);

    return NextResponse.json(
      {
        processes,
        total,
        filtered,
      },
      { status: 200 },
    );
  } catch (_error) {
    return NextResponse.json(
      {
        processes: [],
        total: 0,
        filtered: 0,
      },
      { status: 500 },
    );
  }
}
