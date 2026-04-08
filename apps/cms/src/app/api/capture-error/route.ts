/**
 * Client Error Capture Proxy
 *
 * Forwards client-side error reports to the API's /api/errors endpoint,
 * adding the X-Internal-Token header server-side so the secret is never
 * exposed in the browser bundle.
 */

import config from '@revealui/config';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';

export const dynamic = 'force-dynamic';

async function captureErrorHandler(request: Request): Promise<NextResponse> {
  const secret = config.reveal.secret;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

  if (!secret) {
    // No secret configured — silently accept to avoid breaking the error UI
    return NextResponse.json({ success: true }, { status: 202 });
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
    // Upstream unreachable — accept silently so the error UI is not affected
    return NextResponse.json({ success: true }, { status: 202 });
  }
}

export const POST = withRateLimit(captureErrorHandler, {
  maxAttempts: 50,
  windowMs: 60 * 1000,
  keyPrefix: 'capture-error',
});
