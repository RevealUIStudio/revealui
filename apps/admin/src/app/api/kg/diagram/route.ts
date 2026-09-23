/**
 * RevMind diagram job
 *
 * POST /api/kg/diagram
 *
 * Dual-gate #2884 (`checkAIFeatureGate` + `canAccessKgShapes`), same bar as
 * GET /api/kg/repos. No public unauthenticated endpoint.
 *
 * Pipeline: KG snapshot → Mermaid always SoT → optional themed SVG/PNG.
 * `view: 3d` is P2 and returns 501. `launch_architecture` is Launch /
 * licensed only. Not a public Architecture SKU.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db/client';
import {
  DIAGRAM_FORMATS,
  DIAGRAM_HONESTY,
  DIAGRAM_PURPOSES,
  DIAGRAM_THEMES,
  DIAGRAM_VIEWS,
  type DiagramFormat,
  renderDiagram,
  selectDiagramSubgraph,
} from '@revealui/knowledge-graph/diagram';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { pngFromSvg } from '@/lib/api/kg-diagram-png';
import { loadKgDiagramRows } from '@/lib/api/kg-diagram-snapshot';
import {
  canAccessKgShapes,
  canAccessLaunchArchitecture,
  resolveKgShapeRepoWhere,
} from '@/lib/api/shape-authz';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DiagramJobBodySchema = z
  .object({
    repo: z.string().min(1).optional(),
    selection: z.array(z.string().min(1)).optional(),
    format: z.array(z.enum(DIAGRAM_FORMATS)).min(1),
    purpose: z.enum(DIAGRAM_PURPOSES),
    view: z.enum(DIAGRAM_VIEWS).optional(),
    theme: z.enum(DIAGRAM_THEMES).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    if (!canAccessKgShapes(session.user)) {
      return createApplicationErrorResponse(
        'Forbidden — dual-gate required for RevMind diagrams',
        'FORBIDDEN',
        403,
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON body', 'body', null);
    }

    const parsed = DiagramJobBodySchema.safeParse(json);
    if (!parsed.success) {
      return createValidationErrorResponse('Invalid diagram job body', 'body', json, {
        issues: parsed.error.issues,
      });
    }

    const body = parsed.data;
    const view = body.view ?? '2d';
    const theme = body.theme ?? 'minimal';

    if (view === '3d') {
      return createApplicationErrorResponse(
        '3D view is not available in P1. Use view: "2d".',
        'VIEW_UNSUPPORTED',
        501,
      );
    }

    if (body.purpose === 'launch_architecture' && !canAccessLaunchArchitecture(session.user)) {
      return createApplicationErrorResponse(
        'launch_architecture requires Launch / licensed RevMind (dual-gate #2884). Not a public Architecture SKU.',
        'LAUNCH_ARCHITECTURE_FORBIDDEN',
        403,
      );
    }

    const repoResult = resolveKgShapeRepoWhere(session.user, body.repo ?? null);
    if (!repoResult.ok) {
      const message =
        repoResult.reason === 'missing'
          ? 'repo is required for licensed-operator diagram jobs'
          : 'repo is not a valid identifier';
      return createApplicationErrorResponse(message, 'REPO_SCOPE_REQUIRED', 400);
    }

    const db = getClient();
    const rows = await loadKgDiagramRows(db, { repo: repoResult.repo });
    const snapshot = selectDiagramSubgraph(rows.nodes, rows.edges, {
      purpose: body.purpose,
      selection: body.selection,
    });
    const rendered = renderDiagram(snapshot.nodes, snapshot.edges, {
      purpose: body.purpose,
      theme,
      truncated: snapshot.truncated,
    });

    const formats = uniqueFormats(body.format);
    const payload: Record<string, unknown> = {
      mermaid: rendered.mermaid,
      purpose: rendered.purpose,
      view: rendered.view,
      theme: rendered.theme,
      format: formats,
      graphHash: rendered.graphHash,
      graphVersion: rendered.graphVersion,
      nodeCount: rendered.nodeCount,
      edgeCount: rendered.edgeCount,
      truncated: rendered.truncated,
      honesty: DIAGRAM_HONESTY,
    };

    if (formats.includes('svg') || formats.includes('png')) {
      payload.svg = rendered.svg;
    }

    if (formats.includes('png')) {
      payload.png = await pngFromSvg(rendered.svg);
    }

    return NextResponse.json(payload);
  } catch (error) {
    logger.error('Error running kg diagram job', { error });
    return createErrorResponse(error, {
      endpoint: '/api/kg/diagram',
      operation: 'kg_diagram_job',
    });
  }
}

function uniqueFormats(formats: readonly DiagramFormat[]): DiagramFormat[] {
  const seen = new Set<DiagramFormat>();
  const out: DiagramFormat[] = [];
  for (const format of formats) {
    if (seen.has(format)) continue;
    seen.add(format);
    out.push(format);
  }
  return out;
}
