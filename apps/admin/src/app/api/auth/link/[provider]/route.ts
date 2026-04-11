/**
 * OAuth Link Initiate Route  -  GET /api/auth/link/[provider]
 *
 * Initiates an OAuth flow to link a provider to the current user's account.
 * Requires an active session (user must be authenticated).
 * Uses the same CSRF state mechanism as normal OAuth login, but encodes
 * `intent=link` in the state so the callback knows to link rather than sign in.
 */

import { generateOAuthState, getSession, isRecoverySession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PROVIDERS = ['google', 'github', 'vercel'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    'http://localhost:4000';

  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  // Require authentication  -  only logged-in users can link providers
  const sessionData = await getSession(request.headers, extractRequestContext(request));
  if (!sessionData) {
    return NextResponse.redirect(new URL('/login?error=session_required', baseUrl));
  }

  // Block recovery sessions from linking OAuth providers
  if (isRecoverySession(sessionData)) {
    return NextResponse.redirect(new URL('/login?error=recovery_session_restricted', baseUrl));
  }

  // Use the same OAuth initiation flow but with a link-specific redirect
  // The callback will check for the link_oauth_state cookie to distinguish
  // link flow from login flow.
  const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/admin/settings';
  const { state, cookieValue, codeChallenge } = generateOAuthState(provider, redirectTo);

  // Build the auth URL using the link callback endpoint
  const redirectUri = `${baseUrl}/api/auth/link/callback/${provider}`;

  // Import buildAuthUrl dynamically to reuse the same provider dispatch
  const { buildAuthUrl } = await import('@revealui/auth/server');

  let authUrl: string;
  try {
    authUrl = buildAuthUrl(provider, redirectUri, state, codeChallenge);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth not configured';
    return NextResponse.redirect(
      new URL(`/admin/settings?error=${encodeURIComponent(message)}`, baseUrl),
    );
  }

  const response = NextResponse.redirect(authUrl);

  // Use a separate cookie name so the link callback can distinguish itself
  response.cookies.set('link_oauth_state', cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
