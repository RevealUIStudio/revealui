/**
 * Client Error Capture Proxy
 *
 * Forwards client-side error reports to the API's /api/errors endpoint,
 * adding the X-Internal-Token header server-side so the secret is never
 * exposed in the browser bundle.
 *
 * Auth: a session cookie OR a dedicated ingest token
 * (`X-Error-Ingest-Token` / `REVEALUI_ERROR_INGEST_TOKEN`). Missing
 * `REVEALUI_SECRET` fails closed — never 202 with an empty deputy token.
 */

import { timingSafeEqual } from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import config from '@revealui/config';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';

const INGEST_TOKEN_HEADER = 'x-error-ingest-token';

function tokensEqual(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function isAuthorizedIngest(request: Request): Promise<boolean> {
  const presented = request.headers.get(INGEST_TOKEN_HEADER);
  const expected = process.env.REVEALUI_ERROR_INGEST_TOKEN;
  if (presented && expected && tokensEqual(presented, expected)) {
    return true;
  }
  const session = await getSession(request.headers, extractRequestContext(request));
  return session != null;
}

async function captureErrorHandler(request: Request): Promise<NextResponse> {
  const secret = config.reveal.secret;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Error ingest is not configured' },
      { status: 503 },
    );
  }

  if (!(await isAuthorizedIngest(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${apiUrl}/api/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': secret,
      },
      body,
    });

    const data = (await upstream.json()) as Record<string, unknown>;
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    // Upstream unreachable  -  accept locally so an authenticated error UI
    // is not blocked. Authorization already ran.
    return NextResponse.json({ success: true }, { status: 202 });
  }
}

export const POST = withRateLimit(captureErrorHandler, {
  maxAttempts: 50,
  windowMs: 60 * 1000,
  keyPrefix: 'capture-error',
});
