import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { apiForwardHeaders } from '@/lib/utils/api-proxy-headers';
import { extractRequestContext } from '@/lib/utils/request-context';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

interface RouteParams {
  params: Promise<{ collection: string; id: string }>;
}

async function proxyRequest(
  request: NextRequest,
  { params }: RouteParams,
  method: string,
): Promise<NextResponse> {
  // Fail-closed session gate, mirroring the sibling list proxy
  // (app/api/collections/[collection]/route.ts). The api server enforces
  // per-collection permissions on the forwarded cookie, but this proxy must
  // not forward at all without a validated session — defence-in-depth so an
  // unauthenticated request never reaches the content API.
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { collection, id } = await params;

  const headers = await apiForwardHeaders(request);

  const init: RequestInit = { method, headers };

  if (method === 'PATCH' || method === 'POST') {
    headers['Content-Type'] = 'application/json';
    init.body = await request.text();
  }

  const apiResponse = await fetch(`${API_URL}/api/content/${collection}/${id}`, init);

  if (!apiResponse.ok) {
    const text = await apiResponse.text();
    logger.error('Content API request failed', new Error(text || 'Unknown error'), {
      collection,
      id,
      method,
      status: apiResponse.status,
    });
    return NextResponse.json({ error: 'API request failed' }, { status: apiResponse.status });
  }

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  return proxyRequest(request, context, 'GET');
}

export async function PATCH(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  return proxyRequest(request, context, 'PATCH');
}

export async function DELETE(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  return proxyRequest(request, context, 'DELETE');
}
