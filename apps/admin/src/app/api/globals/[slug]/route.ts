import { getSession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { apiForwardHeaders } from '@/lib/utils/api-proxy-headers';
import { extractRequestContext } from '@/lib/utils/request-context';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

/** Map status codes to safe client-facing messages (never leak internal errors). */
function sanitizeErrorResponse(status: number): string {
  switch (true) {
    case status === 400:
      return 'Bad request';
    case status === 401:
      return 'Unauthorized';
    case status === 403:
      return 'Forbidden';
    case status === 404:
      return 'Not found';
    case status === 429:
      return 'Too many requests';
    case status >= 500:
      return 'Internal server error';
    default:
      return 'Request failed';
  }
}

/**
 * The canonical content endpoint returns `{ success, data }`; the admin client
 * (packages/core client apiClient) consumes the engine-REST `{ doc }` shape.
 * Adapt here so the dashboard global editor keeps its expected response.
 */
function unwrapGlobal(payload: unknown): unknown {
  if (payload !== null && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  // Fail-closed session gate, mirroring the collections list proxy. The read
  // side of the canonical endpoint is public, but this admin proxy only serves
  // authenticated dashboard sessions, so it must not forward without one.
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const apiResponse = await fetch(
    `${API_URL}/api/content/globals/${slug}?${searchParams.toString()}`,
    {
      headers: await apiForwardHeaders(request),
    },
  );

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: sanitizeErrorResponse(apiResponse.status) },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json({ doc: unwrapGlobal(data) }, { status: apiResponse.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json();

  const apiResponse = await fetch(`${API_URL}/api/content/globals/${slug}`, {
    method: 'PATCH',
    headers: await apiForwardHeaders(request, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: sanitizeErrorResponse(apiResponse.status) },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json({ doc: unwrapGlobal(data) }, { status: apiResponse.status });
}
