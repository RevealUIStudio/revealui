/**
 * Yjs Document Patches Shape Proxy Route
 *
 * GET /api/shapes/yjs-document-patches?document_id=<document_id>
 *
 * Authenticated proxy for ElectricSQL yjs_document_patches shape.
 * GAP-477: same document ACL as yjs-documents (owner or platform admin).
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { userCanAccessYjsDocument } from '@/lib/api/shape-authz';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
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

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const documentId = new URL(request.url).searchParams.get('document_id');
    if (!documentId || documentId.trim().length === 0) {
      return createValidationErrorResponse(
        'document_id query parameter is required',
        'document_id',
        documentId,
        { example: '/api/shapes/yjs-document-patches?document_id=scratchpad-abc123' },
      );
    }

    if (!isSyncIdentifier(documentId)) {
      return createValidationErrorResponse(
        'document_id must contain only alphanumeric characters, hyphens, and underscores',
        'document_id',
        documentId,
      );
    }

    const db = getClient();
    const allowed = await userCanAccessYjsDocument(
      db,
      session.user.id,
      documentId,
      session.user.role,
    );
    if (!allowed) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'yjs_document_patches');
    originUrl.searchParams.set('where', `document_id = '${documentId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying yjs document patches shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/yjs-document-patches',
      operation: 'yjs_document_patches_proxy',
    });
  }
}
