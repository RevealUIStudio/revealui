/**
 * Reconciliation Trigger Route
 *
 * POST /api/sync/reconcile - Trigger LLM reconciliation for a coordination session
 *
 * Reads unreconciled shared facts, calls the reconciliation service,
 * creates canonical memories, and marks source facts as superseded.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { agentMemories, sharedFacts } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { and, eq, isNull } from 'drizzle-orm';
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

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

interface ReconciliationResult {
  canonicalFacts: Array<{
    content: string;
    type: string;
    sourceFactIds: string[];
    confidence: number;
  }>;
  contradictions: Array<{
    factIds: string[];
    resolution: string;
  }>;
  duplicates: string[][];
}

/**
 * Simple reconciliation logic. In production this calls the LLM reconciliation
 * service from @revealui/ai. For now, deduplicates by content similarity and
 * groups facts by type.
 */
function reconcileFacts(
  facts: Array<{ id: string; content: string; factType: string; confidence: number }>,
): ReconciliationResult {
  const seen = new Map<string, string[]>();
  const canonicalFacts: ReconciliationResult['canonicalFacts'] = [];
  const duplicates: string[][] = [];

  // Group by normalized content for dedup
  for (const fact of facts) {
    const normalized = fact.content.toLowerCase().trim();
    const existing = seen.get(normalized);
    if (existing) {
      existing.push(fact.id);
    } else {
      seen.set(normalized, [fact.id]);
    }
  }

  for (const [, ids] of seen) {
    if (ids.length > 1) {
      duplicates.push(ids);
    }
    // Take the first fact as canonical
    const sourceFact = facts.find((f) => f.id === ids[0]);
    if (sourceFact) {
      canonicalFacts.push({
        content: sourceFact.content,
        type: sourceFact.factType === 'bug' ? 'warning' : 'fact',
        sourceFactIds: ids,
        confidence: sourceFact.confidence,
      });
    }
  }

  return { canonicalFacts, contradictions: [], duplicates };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      session_id?: string;
      site_id?: string;
    };

    if (!(body.session_id && SESSION_ID_RE.test(body.session_id))) {
      return createValidationErrorResponse(
        'session_id is required and must be alphanumeric with hyphens/underscores',
        'session_id',
        body.session_id,
      );
    }

    if (!body.site_id || body.site_id.trim().length === 0) {
      return createValidationErrorResponse('site_id is required', 'site_id', body.site_id);
    }

    const db = getClient();

    // Get unreconciled facts (not yet superseded)
    const unreconciledFacts = await db
      .select()
      .from(sharedFacts)
      .where(and(eq(sharedFacts.sessionId, body.session_id), isNull(sharedFacts.supersededBy)));

    if (unreconciledFacts.length === 0) {
      return NextResponse.json({
        reconciled: 0,
        message: 'No unreconciled facts found',
      });
    }

    // Run reconciliation
    const result = reconcileFacts(unreconciledFacts);
    const now = new Date();
    const createdMemories: unknown[] = [];

    // Create reconciled memories
    for (const canonical of result.canonicalFacts) {
      const id = crypto.randomUUID();
      const [memory] = await db
        .insert(agentMemories)
        .values({
          id,
          content: canonical.content,
          type: canonical.type,
          source: { reconciliation: true, sessionId: body.session_id },
          siteId: body.site_id,
          scope: 'reconciled',
          sessionScope: body.session_id,
          sourceFacts: canonical.sourceFactIds,
          reconciledAt: now,
        })
        .returning();
      createdMemories.push(memory);

      // Mark source facts as superseded
      for (const factId of canonical.sourceFactIds) {
        await db.update(sharedFacts).set({ supersededBy: id }).where(eq(sharedFacts.id, factId));
      }
    }

    return NextResponse.json({
      reconciled: result.canonicalFacts.length,
      duplicatesFound: result.duplicates.length,
      contradictions: result.contradictions.length,
      memories: createdMemories,
    });
  } catch (error) {
    logger.error('Error running reconciliation', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/reconcile',
      operation: 'reconcile_shared_facts',
    });
  }
}
