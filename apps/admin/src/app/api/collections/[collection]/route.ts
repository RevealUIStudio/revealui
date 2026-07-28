import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { resolveDefaultSiteId } from '@/lib/db/defaultSite';
import { apiForwardHeaders } from '@/lib/utils/api-proxy-headers';
import { extractRequestContext } from '@/lib/utils/request-context';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

/**
 * Pages are the one site-scoped content collection: the API exposes list/create
 * only under `/sites/:siteId/pages`, while every other collection lists/creates
 * flat under `/:collection`. The dashboard supplies the site scope here — an
 * explicit `siteId` when a site is selected, otherwise the server-resolved
 * default site (single-site operators never choose one). All other collections
 * keep the flat path unchanged.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function resolveListTarget(
  collection: string,
  searchParams: URLSearchParams,
): Promise<string> {
  if (collection !== 'pages') {
    return `${API_URL}/api/content/${collection}?${searchParams.toString()}`;
  }
  const forwarded = new URLSearchParams(searchParams);
  const explicit = forwarded.get('siteId');
  forwarded.delete('siteId');
  const siteId = explicit && explicit.length > 0 ? explicit : await resolveDefaultSiteId();
  const query = forwarded.toString();
  return `${API_URL}/api/content/sites/${encodeURIComponent(siteId)}/pages${query ? `?${query}` : ''}`;
}

async function resolveCreateTarget(collection: string, body: unknown): Promise<string> {
  if (collection !== 'pages') {
    return `${API_URL}/api/content/${collection}`;
  }
  const explicit =
    isRecord(body) && typeof body.siteId === 'string' && body.siteId.length > 0
      ? body.siteId
      : undefined;
  const siteId = explicit ?? (await resolveDefaultSiteId());
  return `${API_URL}/api/content/sites/${encodeURIComponent(siteId)}/pages`;
}

function apiUnavailable(collection: string, error: unknown): NextResponse {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Content API unavailable', err, { collection });
  return NextResponse.json({ error: 'Content API unavailable' }, { status: 503 });
}

async function proxyResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) {
    const text = await response.text();
    logger.error('Content API request failed', new Error(text || 'Unknown error'), {
      status: response.status,
    });
    return NextResponse.json({ error: 'API request failed' }, { status: response.status });
  }
  const data = await response.json();

  // Normalize API response shape for the admin dashboard.
  // The Hono API returns { success, data: T[] } but APIClient.find() reads { docs, totalDocs }.
  // Users route already returns { docs, ... }  -  only transform the { data } envelope.
  if (data && Array.isArray(data.data) && !data.docs) {
    return NextResponse.json(
      { docs: data.data, totalDocs: data.data.length, totalPages: 1, page: 1 },
      { status: response.status },
    );
  }

  // Upload create (media) returns { success, data: T }; normalize for APIClient.
  if (
    data &&
    typeof data === 'object' &&
    data.data &&
    !Array.isArray(data.data) &&
    !data.docs &&
    !data.doc
  ) {
    return NextResponse.json({ doc: data.data }, { status: response.status });
  }

  return NextResponse.json(data, { status: response.status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { collection } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const apiResponse = await fetch(await resolveListTarget(collection, searchParams), {
      headers: await apiForwardHeaders(request),
    });
    return proxyResponse(apiResponse);
  } catch (err) {
    return apiUnavailable(collection, err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { collection } = await params;
  const contentType = request.headers.get('content-type') ?? '';

  // GAP-452: upload collections (media) create via multipart. Stream the body
  // through like /api/media so the api server's single-sourced validator stays
  // the only upload gate. JSON create for non-upload collections is unchanged.
  if (contentType.startsWith('multipart/form-data')) {
    try {
      const target = await resolveCreateTarget(collection, undefined);
      const init: RequestInit & { duplex: 'half' } = {
        method: 'POST',
        headers: await apiForwardHeaders(request, { 'Content-Type': contentType }),
        body: request.body,
        duplex: 'half',
      };
      const apiResponse = await fetch(target, init);
      return proxyResponse(apiResponse);
    } catch (err) {
      return apiUnavailable(collection, err);
    }
  }

  const body = await request.json();

  try {
    const apiResponse = await fetch(await resolveCreateTarget(collection, body), {
      method: 'POST',
      headers: await apiForwardHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    return proxyResponse(apiResponse);
  } catch (err) {
    return apiUnavailable(collection, err);
  }
}
