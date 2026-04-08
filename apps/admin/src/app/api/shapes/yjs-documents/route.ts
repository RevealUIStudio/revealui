/**
 * Yjs Documents Shape Proxy Route
 *
 * GET /api/shapes/yjs-documents
 *
 * Authenticated proxy for ElectricSQL yjs_documents shape.
 * Access control: authenticated session + valid document UUID.
 * yjs_documents has no user_id column — documents are collaborative (shared by UUID).
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('document_id');

    if (!(documentId && UUID_RE.test(documentId))) {
      return createApplicationErrorResponse(
        'Missing or invalid document_id: must be a UUID',
        'VALIDATION_ERROR',
        400,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'yjs_documents');
    // Inline the validated UUID in the where clause (safe — UUID format verified above)
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
