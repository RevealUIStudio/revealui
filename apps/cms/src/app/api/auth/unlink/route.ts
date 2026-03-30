/**
 * OAuth Unlink Route — POST /api/auth/unlink
 *
 * Removes an OAuth provider link from the authenticated user's account.
 * Refuses to unlink the last authentication method (prevents lockout).
 *
 * Request body: { provider: string }
 */

import { getSession, unlinkOAuthAccount } from '@revealui/auth/server';
import { logger } from '@revealui/core/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PROVIDERS = ['google', 'github', 'vercel'] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require authentication
  const sessionData = await getSession(request.headers, extractRequestContext(request));
  if (!sessionData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const provider =
    typeof body === 'object' && body !== null && 'provider' in body
      ? String((body as { provider: unknown }).provider)
      : null;

  if (!(provider && (ALLOWED_PROVIDERS as readonly string[]).includes(provider))) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  try {
    await unlinkOAuthAccount(sessionData.user.id, provider);
    return NextResponse.json({ success: true, unlinked: provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unlink account';
    logger.error('OAuth unlink error', { provider, userId: sessionData.user.id, error: err });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
