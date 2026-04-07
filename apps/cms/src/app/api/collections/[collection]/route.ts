import { logger } from '@revealui/core/observability/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { getContentApiUrl } from '@/lib/config/api';

const API_URL = getContentApiUrl();

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
  // Users route already returns { docs, ... } — only transform the { data } envelope.
  if (data && Array.isArray(data.data) && !data.docs) {
    return NextResponse.json(
      { docs: data.data, totalDocs: data.data.length, totalPages: 1, page: 1 },
      { status: response.status },
    );
  }

  return NextResponse.json(data, { status: response.status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const { collection } = await params;
  const { searchParams } = new URL(request.url);

  try {
    const apiResponse = await fetch(
      `${API_URL}/api/content/${collection}?${searchParams.toString()}`,
      {
        headers: {
          Cookie: request.headers.get('Cookie') ?? '',
        },
      },
    );
    return proxyResponse(apiResponse);
  } catch (err) {
    return apiUnavailable(collection, err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const { collection } = await params;
  const body = await request.json();

  try {
    const apiResponse = await fetch(`${API_URL}/api/content/${collection}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('Cookie') ?? '',
      },
      body: JSON.stringify(body),
    });
    return proxyResponse(apiResponse);
  } catch (err) {
    return apiUnavailable(collection, err);
  }
}
