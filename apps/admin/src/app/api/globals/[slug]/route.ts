import { type NextRequest, NextResponse } from 'next/server';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const apiResponse = await fetch(`${API_URL}/api/globals/${slug}?${searchParams.toString()}`, {
    headers: {
      Cookie: request.headers.get('Cookie') ?? '',
    },
  });

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: sanitizeErrorResponse(apiResponse.status) },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const body = await request.json();

  const apiResponse = await fetch(`${API_URL}/api/globals/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') ?? '',
    },
    body: JSON.stringify(body),
  });

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: sanitizeErrorResponse(apiResponse.status) },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}
