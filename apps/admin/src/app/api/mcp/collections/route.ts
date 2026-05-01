/**
 * MCP Collections Registry — GET /api/mcp/collections
 *
 * Stage 4.2 of the MCP v1 plan. Enumerates every CollectionConfig registered
 * with the admin instance and returns a summary that includes the resolved
 * `mcpResource` flag (default `true` when absent — see Stage 4.1 contract).
 *
 * Consumers:
 *   - The `revealui-content` MCP server factory uses this to decide which
 *     collections to advertise as MCP resources. Curated `posts/pages/
 *     products/media` fallback still applies in standalone stdio mode when
 *     the admin endpoint is unreachable or credentials are not configured.
 *   - The `/mcp` page renders the list (both exposed and hidden) in a
 *     read-only "Content exposure" section.
 *
 * Auth: accepts either an authenticated admin session (UI consumer) or a
 * `Authorization: Bearer <REVEALUI_API_KEY>` header whose value matches the
 * admin's configured `REVEALUI_API_KEY` env var (factory / out-of-process
 * consumer). Comparison is constant-time to avoid timing leaks.
 */

import { timingSafeEqual } from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { allCollections } from '@/lib/collections/registry';
import { resolveCollectionMcpSummary } from '@/lib/mcp/collections';
import { extractRequestContext } from '@/lib/utils/request-context';

/** Constant-time compare for bearer-token auth. */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function hasValidBearerToken(request: NextRequest): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return false;
  const provided = match[1];
  const expected = process.env.REVEALUI_API_KEY;
  if (!(expected && expected.length > 0 && provided)) return false;
  return safeCompare(provided, expected);
}

export async function GET(request: NextRequest) {
  if (!hasValidBearerToken(request)) {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const collections = allCollections.map((c) => resolveCollectionMcpSummary(c));
  return NextResponse.json({ collections });
}
