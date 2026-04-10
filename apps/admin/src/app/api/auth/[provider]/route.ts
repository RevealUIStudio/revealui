/**
 * OAuth Initiate Route — GET /api/auth/[provider]
 *
 * Redirects the user to the provider's authorization page.
 * Sets a signed state cookie for CSRF protection.
 *
 * Query params:
 * - redirectTo: URL to redirect to after auth (default: /admin)
 * - linkConsent: "true" if the user has consented to link their OAuth
 *   account to an existing local account with the same email.
 */

import { buildAuthUrl, generateOAuthState } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PROVIDERS = ['google', 'github', 'vercel'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;

  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    'http://localhost:4000';

  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;
  const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/admin';
  const linkConsent = request.nextUrl.searchParams.get('linkConsent') === 'true';

  const { state, cookieValue, codeChallenge } = generateOAuthState(provider, redirectTo, {
    linkConsent: linkConsent || undefined,
  });

  let authUrl: string;
  try {
    authUrl = buildAuthUrl(provider, redirectUri, state, codeChallenge);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth not configured';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, baseUrl));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('oauth_state', cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
