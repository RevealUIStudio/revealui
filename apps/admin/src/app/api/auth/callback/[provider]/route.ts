/**
 * OAuth Callback Route — GET /api/auth/callback/[provider]
 *
 * Handles the redirect from the OAuth provider. Verifies state, exchanges
 * the code for an access token, upserts the user, and creates a session.
 *
 * Account linking consent: When an existing user with the same email is found,
 * the user is redirected to a consent page. When they confirm, the OAuth flow
 * is re-initiated with linkConsent=true in the state, which allows linking.
 */

import {
  exchangeCode,
  fetchProviderUser,
  OAuthAccountConflictError,
  rotateSession,
  upsertOAuthUser,
  verifyOAuthState,
} from '@revealui/auth/server';
import { getMaxUsers, initializeLicense } from '@revealui/core/license';
import { getClient } from '@revealui/db';
import { getOAuthAccountByProviderUser } from '@revealui/db/queries/oauth-accounts';
import { countActiveUsers } from '@revealui/db/queries/users';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';

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

  const loginUrl = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl));

  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    return loginUrl('unknown_provider');
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const stateCookie = request.cookies.get('oauth_state')?.value;

  const verified = verifyOAuthState(state, stateCookie);
  if (!verified) {
    return loginUrl('invalid_state');
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;
    const accessToken = await exchangeCode(
      provider,
      code ?? '',
      redirectUri,
      verified.codeVerifier,
    );
    const providerUser = await fetchProviderUser(provider, accessToken);

    // Allowlist check — leave OAUTH_ADMIN_EMAILS empty to allow any authenticated user
    const allowedEmails = (process.env.OAUTH_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (allowedEmails.length > 0 && !allowedEmails.includes(providerUser.email ?? '')) {
      return loginUrl('not_allowed');
    }

    // Enforce user limit for new OAuth signups (CR5-2)
    // Only check if this OAuth identity doesn't already map to a user
    try {
      await initializeLicense();
      const maxUsers = getMaxUsers();
      if (maxUsers !== Infinity) {
        const db = getClient();
        const existingOAuth = await getOAuthAccountByProviderUser(db, provider, providerUser.id);

        if (!existingOAuth) {
          // New user via OAuth — check limit
          const activeCount = await countActiveUsers(db);
          if (activeCount >= maxUsers) {
            return loginUrl('user_limit_reached');
          }
        }
      }
    } catch (limitError) {
      // Log but don't block — allow OAuth login to proceed
      logger.warn('User limit check failed during OAuth callback', {
        provider,
        error: limitError instanceof Error ? limitError.message : String(limitError),
      });
    }

    // Pass linkConsent from the signed state — when true, the user has
    // explicitly consented to link their OAuth account to the existing
    // local account with the same email.
    const user = await upsertOAuthUser(provider, providerUser, {
      linkConsent: verified.linkConsent,
    });

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const { token } = await rotateSession(user.id, { userAgent, ipAddress, persistent: true });

    // Resolve redirectTo: reject cross-origin URLs to prevent open redirect.
    // startsWith('/') is insufficient — paths like /..//..//attacker.com pass.
    let redirectTo = '/admin';
    try {
      const resolved = new URL(verified.redirectTo, baseUrl);
      const base = new URL(baseUrl);
      if (resolved.hostname === base.hostname) {
        redirectTo = resolved.pathname + resolved.search;
      }
    } catch {
      // Invalid URL — fall back to /admin
    }

    const response = NextResponse.redirect(new URL(redirectTo, baseUrl));

    // Set role hint cookie for proxy.ts admin gate (defense-in-depth).
    const userRole = (user as { role?: string }).role ?? 'user';
    const isAdminRole = ['admin', 'super-admin', 'user-admin', 'user-super-admin'].includes(
      userRole,
    );
    response.cookies.set('revealui-role', isAdminRole ? 'admin' : 'user', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.SESSION_COOKIE_DOMAIN || undefined
          : undefined,
    });

    response.cookies.set('revealui-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain:
        process.env.NODE_ENV === 'production'
          ? (() => {
              if (!process.env.SESSION_COOKIE_DOMAIN) {
                logger.error(
                  'SESSION_COOKIE_DOMAIN env var is required in production — session cookie will not be set cross-subdomain',
                );
              }
              return process.env.SESSION_COOKIE_DOMAIN || undefined;
            })()
          : undefined,
    });

    response.cookies.delete('oauth_state');
    return response;
  } catch (err) {
    if (err instanceof OAuthAccountConflictError) {
      // Redirect to login with consent prompt params.
      // The login page will show: "An account with this email exists. Link your {provider} account?"
      // When the user confirms, it re-initiates OAuth with linkConsent=true.
      const consentParams = new URLSearchParams({
        error: 'account_exists',
        link_provider: provider,
        link_email: err.email,
      });
      return NextResponse.redirect(new URL(`/login?${consentParams.toString()}`, baseUrl));
    }
    logger.error('OAuth callback error', { provider, error: err });
    return loginUrl('oauth_error');
  }
}
