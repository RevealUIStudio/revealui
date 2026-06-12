import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { apiForwardHeaders } from '@/lib/utils/api-proxy-headers';
import { extractRequestContext } from '@/lib/utils/request-context';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:3004';

/**
 * POST /api/media — upload forward to the api server.
 *
 * The rich-text editor's ImageUploadButton POSTs multipart FormData to its
 * default `/api/media` endpoint. The upload implementation (contracts-driven
 * MIME/size/magic-byte validation, object storage, media DB row) lives on the
 * api server at POST /api/content/media; forwarding server-side — like the
 * /api/collections/* routes — keeps that implementation single-sourced.
 *
 * The body is streamed through verbatim with the original Content-Type
 * header, so the client's multipart boundary is preserved and the file is
 * never buffered or re-encoded here. `duplex: 'half'` is required by fetch
 * for any streamed request body (and is absent from lib.dom's RequestInit,
 * hence the intersection type).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  try {
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: await apiForwardHeaders(request, { 'Content-Type': contentType }),
      body: request.body,
      duplex: 'half',
    };
    const apiResponse = await fetch(`${API_URL}/api/content/media`, init);

    if (!apiResponse.ok) {
      const text = await apiResponse.text();
      logger.error('Content API request failed', new Error(text || 'Unknown error'), {
        route: 'media-upload',
        status: apiResponse.status,
      });
      return NextResponse.json({ error: 'API request failed' }, { status: apiResponse.status });
    }

    const data = await apiResponse.json();
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Content API unavailable', error, { route: 'media-upload' });
    return NextResponse.json({ error: 'Content API unavailable' }, { status: 503 });
  }
}
