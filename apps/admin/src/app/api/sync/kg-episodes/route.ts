/**
 * Knowledge Graph Episode Flush Route
 *
 * POST /api/sync/kg-episodes
 *
 * The ONLY write path into `kg_*` tables from the admin app (design spec
 * §8.3 hard invariant: "the only bridge is an explicit 'flush to episode'
 * action"). The Yjs curation overlay (`packages/sync/src/collab/kg-view.ts`)
 * never writes `kg_nodes` / `kg_edges` directly; the explorer's "flush to
 * episode" action POSTs selected annotations/facts here, which validates the
 * body and calls the additive `ingestEpisode` (episodeType always `manual`,
 * never a rescan) server-side — the same write path `kg_add_episode` uses in
 * `@revealui/mcp`'s knowledge-graph MCP server factory.
 *
 * `nodes`/`edges` reuse `KgAddEpisodeArgsSchema`'s exact node/edge shapes
 * from `@revealui/mcp/kg-server` (Zod-validated against the ontology enums —
 * `NODE_KINDS`/`EDGE_RELATIONS` — exactly like `kg_add_episode`), rather than
 * duplicating that schema here. `episodeType` is not client-supplied: this
 * route always ingests as `manual`.
 */

import { hostname } from 'node:os';
import { getSession } from '@revealui/auth/server';
import { getPool } from '@revealui/db/pool';
import {
  type EdgeInput,
  ingestEpisode,
  makePoolExecutor,
  type NodeInput,
} from '@revealui/knowledge-graph';
import { KgAddEpisodeArgsSchema } from '@revealui/mcp/kg-server';
import { isValidKgViewSlug } from '@revealui/sync/collab/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KgFlushArgsSchema = z
  .object({
    viewSlug: z.string().min(1),
    source: z.string().min(1),
    content: z.string().max(20_000).optional(),
    contentRef: z.record(z.string(), z.unknown()).optional(),
    nodes: KgAddEpisodeArgsSchema.shape.nodes,
    edges: KgAddEpisodeArgsSchema.shape.edges,
  })
  .strict();

interface EmbeddingModule {
  generateEmbedding(text: string): Promise<{ vector: number[] }>;
}

/** Best-effort embedder, mirroring `revkg`'s CLI and the MCP factory's `resolveEmbedder` (`@revealui/ai` is optional). */
async function loadEmbedder(): Promise<((text: string) => Promise<number[]>) | undefined> {
  try {
    const specifier = '@revealui/ai/embeddings';
    const ai = (await import(specifier)) as EmbeddingModule;
    return async (text: string): Promise<number[]> => {
      const result = await ai.generateEmbedding(text);
      return result.vector;
    };
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const body: unknown = await request.json();
    const parsed = KgFlushArgsSchema.safeParse(body);
    if (!parsed.success) {
      return createValidationErrorResponse('Invalid kg episode flush body', 'body', undefined, {
        issues: parsed.error.issues,
      });
    }
    const v = parsed.data;

    if (!isValidKgViewSlug(v.viewSlug)) {
      return createValidationErrorResponse(
        'viewSlug must be lowercase alphanumeric and hyphens only (max 64 chars)',
        'viewSlug',
        v.viewSlug,
      );
    }

    if (v.nodes.length === 0 && v.edges.length === 0) {
      return createValidationErrorResponse(
        'at least one node or edge is required',
        'nodes/edges',
        undefined,
      );
    }

    const nodes: NodeInput[] = v.nodes.map((n) => ({
      kind: n.kind,
      name: n.name,
      naturalKey: n.naturalKey,
      repo: n.repo,
      summary: n.summary,
      attributes: n.attributes,
    }));
    const edges: EdgeInput[] = v.edges.map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
      fact: e.fact,
      repo: e.repo,
      validAt: e.validAt ? new Date(e.validAt) : undefined,
      attributes: e.attributes,
    }));

    const exec = makePoolExecutor(getPool());
    const embedder = await loadEmbedder();
    const referenceTime = new Date();

    const result = await ingestEpisode(
      exec,
      {
        episode: {
          episodeType: 'manual',
          source: v.source,
          siteId: `admin-explorer:${hostname()}`,
          content: v.content ?? null,
          contentRef: { ...v.contentRef, viewSlug: v.viewSlug },
          referenceTime,
        },
        nodes,
        edges,
      },
      { embedder, recordOutbox: true },
    );

    return NextResponse.json(
      {
        episodeId: result.episodeId,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('Error flushing kg episode', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/kg-episodes',
      operation: 'kg_episode_flush',
    });
  }
}
