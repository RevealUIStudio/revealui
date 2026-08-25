/**
 * Yjs Documents Shape Proxy Route
 *
 * GET /api/shapes/yjs-documents?document_id=<uuid>
 *
 * Authenticated proxy for ElectricSQL yjs_documents shape.
 * GAP-477: acl_resource — fleet operator may read any UUID doc; everyone
 * else (including hosted CMS admin/owner) only when owner_id matches
 * session user (legacy null owner = operator-only).
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { isFleetOperator, isUuid, userCanAccessYjsDocument } from '@/lib/api/shape-authz';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { isSyncIdentifier } from '@/lib/utils/identifier-validation';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
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

    const db = getClient();
    const allowed = await userCanAccessYjsDocument(db, session.user.id, documentId, session.user);
    if (!allowed) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'yjs_documents');

    // Operator: document id only. Owner: id + owner_id match (defense in depth with the gate above).
    if (isFleetOperator(session.user)) {
      originUrl.searchParams.set('where', `id = '${documentId}'`);
    } else {
      if (!isSyncIdentifier(session.user.id)) {
        return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
      }
      originUrl.searchParams.set(
        'where',
        `id = '${documentId}' AND owner_id = '${session.user.id}'`,
      );
    }

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying yjs-documents shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/yjs-documents',
      operation: 'yjs_documents_proxy',
    });
  }
}
