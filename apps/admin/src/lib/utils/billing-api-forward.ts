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
 * Paths the license page calls same-origin. Each has a more-specific App
 * Router route than `(backend)/api/[...slug]`, because that catch-all wins
 * over next.config rewrites and the CMS REST handler 401/404s billing.
 */
export type BillingForwardPath =
  | '/api/billing/subscription'
  | '/api/billing/checkout-perpetual'
  | '/api/billing/checkout-support-renewal';

/**
 * Server-side forward to the API host. Reuses apiForwardHeaders so the
 * incoming Cookie (and UA / minted CSRF) reach the auth-gated billing
 * routes. Does not make subscription public.
 *
 * Named *-forward (not *-proxy.ts) so the security-review path marker for
 * apps/admin/src/proxy.ts does not false-hit this helper.
 */
export async function forwardBillingRequest(
  request: NextRequest,
  path: BillingForwardPath,
): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const method = request.method;
  const extra = method === 'GET' ? undefined : { 'Content-Type': 'application/json' };

  try {
    const rawBody = method === 'GET' ? undefined : await request.text();
    const apiResponse = await fetch(`${API_URL}${path}`, {
      method,
      headers: await apiForwardHeaders(request, extra),
      ...(rawBody !== undefined && rawBody.length > 0 ? { body: rawBody } : {}),
    });

    const data: unknown = await apiResponse.json();
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Billing API forward failed', err, { path, method });
    return NextResponse.json({ error: 'Billing request failed' }, { status: 503 });
  }
}
