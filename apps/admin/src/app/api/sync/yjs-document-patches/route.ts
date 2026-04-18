/**
 * Yjs Document Patches Sync Mutation Route
 *
 * POST /api/sync/yjs-document-patches - Submit a structured patch
 *
 * Authenticated. Inserts the patch and applies it to the Yjs document
 * state inline. Electric picks up both the patch row and the updated
 * yjs_documents state.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { yjsDocumentPatches, yjsDocuments } from '@revealui/db/schema';
import { applyPatches } from '@revealui/sync/collab';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
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
const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_PATCH_TYPES = new Set(['append_section', 'append_item', 'replace_section', 'set_key']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      document_id?: string;
      agent_id?: string;
      patch_type?: string;
      path?: string;
      content?: string;
    };

    if (!(body.document_id && DOCUMENT_ID_RE.test(body.document_id))) {
      return createValidationErrorResponse(
        'document_id is required and must be alphanumeric with hyphens/underscores',
        'document_id',
        body.document_id,
      );
    }

    if (!(body.agent_id && AGENT_ID_RE.test(body.agent_id))) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        body.agent_id,
      );
    }

    if (!(body.patch_type && VALID_PATCH_TYPES.has(body.patch_type))) {
      return createValidationErrorResponse(
        `patch_type must be one of: ${[...VALID_PATCH_TYPES].join(', ')}`,
        'patch_type',
        body.patch_type,
      );
    }

    if (!body.path || body.path.trim().length === 0) {
      return createValidationErrorResponse('path is required', 'path', body.path);
    }

    if (!body.content || body.content.trim().length === 0) {
      return createValidationErrorResponse('content is required', 'content', body.content);
    }

    const db = getClient();

    // Insert the patch record
    const [patch] = await db
      .insert(yjsDocumentPatches)
      .values({
        documentId: body.document_id,
        agentId: body.agent_id,
        patchType: body.patch_type,
        path: body.path,
        content: body.content,
      })
      .returning();

    if (!patch) {
      return createApplicationErrorResponse('Failed to insert patch', 'INTERNAL_ERROR', 500);
    }

    // Load existing document state
    const [existing] = await db
      .select()
      .from(yjsDocuments)
      .where(eq(yjsDocuments.id, body.document_id))
      .limit(1);

    // Apply patch via the sync package's patch applier
    const existingState = existing?.state ? new Uint8Array(existing.state) : null;
    const result = applyPatches(existingState, [
      {
        patchType: body.patch_type as
          | 'set_key'
          | 'append_section'
          | 'append_item'
          | 'replace_section',
        path: body.path,
        content: body.content,
      },
    ]);

    // Save updated state
    const state = Buffer.from(result.state);
    const stateVector = Buffer.from(result.stateVector);

    if (existing) {
      await db
        .update(yjsDocuments)
        .set({ state, stateVector, updatedAt: new Date() })
        .where(eq(yjsDocuments.id, body.document_id));
    } else {
      await db.insert(yjsDocuments).values({
        id: body.document_id,
        state,
        stateVector,
      });
    }

    // Mark patch as applied
    await db
      .update(yjsDocumentPatches)
      .set({ applied: true })
      .where(eq(yjsDocumentPatches.id, patch.id));

    return NextResponse.json({ ...patch, applied: true }, { status: 201 });
  } catch (error) {
    logger.error('Error creating yjs document patch', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/yjs-document-patches',
      operation: 'create_yjs_document_patch',
    });
  }
}
