import { type NextRequest, NextResponse } from 'next/server';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

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
    const text = await apiResponse.text();
    return NextResponse.json(
      { error: text || 'API request failed' },
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
    const text = await apiResponse.text();
    return NextResponse.json(
      { error: text || 'API request failed' },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}
