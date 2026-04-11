import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid batch action' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const apiResponse = await fetch(`${API_URL}/api/content/batch/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('Cookie') ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = await apiResponse.json();
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Batch API proxy failed', err, { action });
    return NextResponse.json({ error: 'Batch operation failed' }, { status: 503 });
  }
}
