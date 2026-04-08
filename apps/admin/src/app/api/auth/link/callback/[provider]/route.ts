/**
 * OAuth Link Callback Route — GET /api/auth/link/callback/[provider]
 *
 * Handles the redirect from the OAuth provider during account linking.
 * Verifies the user's session, exchanges the code, and links the provider
 * to the authenticated user's account.
 */

import {
  exchangeCode,
  fetchProviderUser,
  getSession,
  linkOAuthAccount,
  verifyOAuthState,
} from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
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

  const settingsUrl = (error?: string) => {
    const url = new URL('/admin/settings', baseUrl);
    if (error) url.searchParams.set('error', error);
    return NextResponse.redirect(url);
  };

  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    return settingsUrl('unknown_provider');
  }

  // Require active session — linking is only valid for authenticated users
  const sessionData = await getSession(request.headers, extractRequestContext(request));
  if (!sessionData) {
    return NextResponse.redirect(new URL('/login?error=session_expired', baseUrl));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  // Use the link-specific cookie (not the login cookie)
  const stateCookie = request.cookies.get('link_oauth_state')?.value;

  const verified = verifyOAuthState(state, stateCookie);
  if (!verified) {
    return settingsUrl('invalid_state');
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/link/callback/${provider}`;
    const accessToken = await exchangeCode(provider, code ?? '', redirectUri);
    const providerUser = await fetchProviderUser(provider, accessToken);

    // Link the provider to the authenticated user
    await linkOAuthAccount(sessionData.user.id, provider, providerUser);

    // Resolve redirectTo safely
    let redirectTo = '/admin/settings';
    try {
      const resolved = new URL(verified.redirectTo, baseUrl);
      const base = new URL(baseUrl);
      if (resolved.hostname === base.hostname) {
        redirectTo = resolved.pathname + resolved.search;
      }
    } catch {
      // Invalid URL — fall back to settings
    }

    const successUrl = new URL(redirectTo, baseUrl);
    successUrl.searchParams.set('linked', provider);
    const response = NextResponse.redirect(successUrl);

    // Clean up the link cookie
    response.cookies.delete('link_oauth_state');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to link account';
    logger.error('OAuth link callback error', { provider, error: err });
    const response = settingsUrl(message);
    response.cookies.delete('link_oauth_state');
    return response;
  }
}
