/**
 * Knowledge Graph Curation-View Shape Proxy Route
 *
 * GET /api/shapes/kg-views?document_id=kg-view-<slug>
 *
 * Authenticated proxy for the ElectricSQL `yjs_documents` shape, scoped to
 * kg-view curation-overlay documents (design spec §8.3). Reuses the EXISTING
 * `yjs_documents` table (extend, never a new table) but is a separate route
 * from `/api/shapes/yjs-documents`, whose entire validation contract is
 * "UUID or refuse" — kg-view document ids are `kg-view-<slug>`, never a
 * UUID. Keeping this route narrowly scoped to that one id shape, rather than
 * broadening the existing UUID-only route's accepted id space, keeps the
 * already-shipped route's review surface untouched. Flagged for the Fable
 * review as a trade-off worth a second opinion (documented in the PR body):
 * a small amount of route duplication (~40 lines, same shape as the sibling
 * route) versus reopening a security-reviewed route's validation contract.
 *
 * `document_id` is validated via {@link isKgViewDocumentId} (character-set
 * check on the `kg-view-` prefix + slug, no authored regex) before being
 * inlined into the Electric `where` clause.
 */

import { getSession } from '@revealui/auth/server';
import { isKgViewDocumentId } from '@revealui/sync/collab/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { requireAdminRole } from '@/lib/api/shape-authz';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
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

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    if (!requireAdminRole(session.user.role)) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const documentId = new URL(request.url).searchParams.get('document_id');
    if (!(documentId && isKgViewDocumentId(documentId))) {
      return createApplicationErrorResponse(
        'Missing or invalid document_id: must be a kg-view-<slug> id',
        'VALIDATION_ERROR',
        400,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'yjs_documents');
    originUrl.searchParams.set('where', `id = '${documentId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying kg-views shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/kg-views',
      operation: 'kg_views_proxy',
    });
  }
}
