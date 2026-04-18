/**
 * Yjs Document Patches Shape Proxy Route
 *
 * GET /api/shapes/yjs-document-patches?document_id=<document_id>
 *
 * Authenticated proxy for ElectricSQL yjs_document_patches shape.
 * Scoped by document ID so subscribers see patches for their scratchpad.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOCUMENT_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const documentId = new URL(request.url).searchParams.get('document_id');
    if (!documentId || documentId.trim().length === 0) {
      return createValidationErrorResponse(
        'document_id query parameter is required',
        'document_id',
        documentId,
        { example: '/api/shapes/yjs-document-patches?document_id=scratchpad-abc123' },
      );
    }

    if (!DOCUMENT_ID_RE.test(documentId)) {
      return createValidationErrorResponse(
        'document_id must contain only alphanumeric characters, hyphens, and underscores',
        'document_id',
        documentId,
      );
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
