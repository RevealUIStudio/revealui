/**
 * Yjs Documents Shape Proxy Route
 *
 * GET /api/shapes/yjs-documents?document_id=<uuid>
 *
 * Authenticated proxy for ElectricSQL yjs_documents shape.
 * GAP-476: fail-closed to isAdminRole — table has no user_id / ACL column.
 * Residual Phase C: document-level ACL when ownership model lands.
 * UUID-only document_id still required for the Electric where clause.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { isUuid, requireAdminRole } from '@/lib/api/shape-authz';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (!requireAdminRole(session.user.role)) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('document_id');

    if (!(documentId && isUuid(documentId))) {
      return createApplicationErrorResponse(
        'Missing or invalid document_id: must be a UUID',
        'VALIDATION_ERROR',
        400,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'yjs_documents');
    originUrl.searchParams.set('where', `id = '${documentId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying yjs-documents shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/yjs-documents',
      operation: 'yjs_documents_proxy',
    });
  }
}
