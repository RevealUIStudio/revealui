/**
 * Task Submissions Shape Proxy Route
 *
 * GET /api/shapes/task-submissions
 *
 * Authenticated proxy for ElectricSQL task_submissions shape.
 * Row-level filtered to the authenticated user's own submissions.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_SEGMENTS = [8, 4, 4, 4, 12] as const;
const HEX_CHARS = new Set('0123456789abcdef');

function isUuid(value: string): boolean {
  if (value.length !== 36) return false;
  const parts = value.toLowerCase().split('-');
  if (parts.length !== UUID_SEGMENTS.length) return false;
  return UUID_SEGMENTS.every((len, i) => {
    const part = parts[i];
    return (
      part !== undefined && part.length === len && Array.from(part).every((c) => HEX_CHARS.has(c))
    );
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userId = session.user.id;
    if (!isUuid(userId)) {
      return createValidationErrorResponse('Invalid user ID format', 'userId', userId, {
        expectedFormat: 'UUID',
      });
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'task_submissions');
    // Inline the validated UUID in the where clause (safe — UUID format verified above)
    originUrl.searchParams.set('where', `submitter_id = '${userId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying task-submissions shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/task-submissions',
      operation: 'task_submissions_proxy',
    });
  }
}
