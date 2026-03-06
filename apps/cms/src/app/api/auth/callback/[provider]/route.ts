/**
 * OAuth Callback Route — GET /api/auth/callback/[provider]
 *
 * Handles the redirect from the OAuth provider. Verifies state, exchanges
 * the code for an access token, upserts the user, and creates a session.
 */

import {
  createSession,
  exchangeCode,
  fetchProviderUser,
  OAuthAccountConflictError,
  upsertOAuthUser,
  verifyOAuthState,
} from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_PROVIDERS = ['google', 'github', 'vercel'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000'

  const loginUrl = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl))

  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) {
    return loginUrl('unknown_provider')
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const stateCookie = request.cookies.get('oauth_state')?.value

  const verified = verifyOAuthState(state, stateCookie)
  if (!verified) {
    return loginUrl('invalid_state')
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/${provider}`
    const accessToken = await exchangeCode(provider, code ?? '', redirectUri)
    const providerUser = await fetchProviderUser(provider, accessToken)

    // Allowlist check — leave OAUTH_ADMIN_EMAILS empty to allow any authenticated user
    const allowedEmails = (process.env.OAUTH_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)

    if (allowedEmails.length > 0 && !allowedEmails.includes(providerUser.email ?? '')) {
      return loginUrl('not_allowed')
    }

    const user = await upsertOAuthUser(provider, providerUser)

    const userAgent = request.headers.get('user-agent') ?? undefined
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ??
      request.headers.get('x-real-ip') ??
      undefined

    const { token } = await createSession(user.id, { userAgent, ipAddress, persistent: true })

    // Resolve redirectTo: reject cross-origin URLs to prevent open redirect.
    // startsWith('/') is insufficient — paths like /..//..//attacker.com pass.
    let redirectTo = '/admin'
    try {
      const resolved = new URL(verified.redirectTo, baseUrl)
      const base = new URL(baseUrl)
      if (resolved.hostname === base.hostname) {
        redirectTo = resolved.pathname + resolved.search
      }
    } catch {
      // Invalid URL — fall back to /admin
    }

    const response = NextResponse.redirect(new URL(redirectTo, baseUrl))

    response.cookies.set('revealui-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.SESSION_COOKIE_DOMAIN || '.revealui.com'
          : undefined,
    })

    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    if (err instanceof OAuthAccountConflictError) {
      return loginUrl('account_exists')
    }
    logger.error('OAuth callback error', { provider, error: err })
    return loginUrl('oauth_error')
  }
}
