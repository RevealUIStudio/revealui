import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildAdminCsp, generateNonce } from './lib/security/csp';
import { generateCsrfToken, validateCsrfToken } from './lib/utils/csrf-token';
import { safePostAuthRedirect } from './lib/utils/safe-internal-redirect';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const CSRF_EXEMPT_PREFIXES = [
  // Pre-auth endpoints are hit before a session exists, so they must not be CSRF-gated.
  // The gate below keys on session-cookie PRESENCE (not validity), so a STALE/invalid
  // `revealui-session` cookie — e.g. one left over after a secret rotation invalidated old
  // sessions — would otherwise demand a CSRF token the login form never sends, producing a
  // spurious "CSRF token missing" 403 that blocks sign-in until the user clears cookies.
  // (`/api/auth/password-reset` below is already exempt for the same reason.)
  '/api/auth/sign-in',
  '/api/auth/sign-up',
  '/api/auth/passkey/authenticate',
  '/api/webhooks/',
  '/api/cron/',
  '/api/health',
  '/api/setup',
  '/api/logs',
  '/api/auth/password-reset',
  '/.well-known/',
  '/a2a/',
] as const;

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Define allowed origins for CORS
const allowedOrigins = process.env.REVEALUI_CORS_ORIGINS
  ? process.env.REVEALUI_CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:4000'];

// Public paths in the (frontend) route group: no session required.
// Any (backend) page resolves to a path that is NOT in this set and is NOT
// internal (`/api/`, `/_next/`), so the auth gate kicks in.
//
// NOTE: `/forgot-password` is deliberately NOT here. No route renders it —
// the password-recovery flow starts at `/reset-password` (linked from the
// login form). Whitelisting it as public meant the request fell through to
// the `(frontend)/[slug]` CMS catch-all UNAUTHENTICATED, so a CMS page with
// slug `forgot-password` would render publicly. Dropping it makes the auth
// gate treat it as protected; the catch-all also refuses reserved auth slugs
// (see RESERVED_AUTH_SLUGS in app/(frontend)/[slug]/page.tsx).
const PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/mfa',
  '/rotate-password',
  '/reset-password',
  '/setup',
]);

// Roles that grant full dashboard access including admin-only paths.
const ADMIN_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'super-admin']);

// Admin-only paths require owner/admin role. Non-admin authenticated users
// are redirected to /welcome when they try to access these.
const ADMIN_ONLY_PREFIXES = ['/settings', '/users'] as const;

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Legacy `/admin/*` paths from before the chip-2 URL flatten (#644) — 301 to
// flat path. Catches stale bookmarks and any external links written against
// the pre-flatten URLs. MUST be `/admin` (the historical prefix); empty
// string makes `pathname.startsWith('${PREFIX}/')` match every request and
// `pathname.slice(0)` redirect to itself, causing ERR_TOO_MANY_REDIRECTS.
const LEGACY_ADMIN_PREFIX = '/admin';

// Next.js 16 proxy convention (src/proxy.ts)
// NOTE: Rate limiting is handled per-route via withRateLimit() in API route handlers.
// Proxy runs in Edge Runtime on Vercel and cannot import Node.js-only modules
// (Drizzle ORM, pg driver, etc.) required by the rate limit storage layer.
export default async function proxy(request: NextRequest): Promise<NextResponse | Response> {
  const { pathname } = request.nextUrl;

  // Per-request CSP nonce. Next.js reads the nonce from the request's
  // Content-Security-Policy header and applies it to its framework, bundle, and
  // inline bootstrap scripts — which lets us drop 'unsafe-inline' from script-src.
  // The same policy is set on the response for both page and /api routes, so the
  // CSP has a single source (this proxy) rather than also being set statically in
  // next.config.mjs. See ./lib/security/csp.ts.
  const nonce = generateNonce();
  const cspValue = buildAdminCsp({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    isVercel: Boolean(process.env.VERCEL),
    isVercelProd: process.env.VERCEL_ENV === 'production',
    apiUrl: (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim(),
    serverUrl: (process.env.NEXT_PUBLIC_SERVER_URL || '').trim(),
    marketingUrl: (
      process.env.NEXT_PUBLIC_MARKETING_URL ||
      (process.env.REVEALUI_FLEET_MODE === 'true' ? '' : 'https://revealui.com')
    ).trim(),
    isFleetMode: process.env.REVEALUI_FLEET_MODE === 'true',
    r2PublicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || '').trim(),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-revealui-pathname', pathname);
  requestHeaders.set('Content-Security-Policy', cspValue);

  // RevForge domain-lock: when REVFORGE_LICENSED_DOMAIN is set, reject requests from
  // unlicensed domains. Skipped entirely when not running in RevForge mode.
  const licensedDomain = process.env.REVFORGE_LICENSED_DOMAIN?.trim().toLowerCase();
  if (licensedDomain) {
    const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? '';
    const allowed =
      host === licensedDomain ||
      host.endsWith(`.${licensedDomain}`) ||
      host === 'localhost' ||
      host === '127.0.0.1';
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'This RevForge instance is not licensed for this domain.' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  // Legacy /* paths from before the URL flatten — 301 to flat path.
  // Catches bookmarks and external links written against the pre-flatten URLs.
  // Order matters: this must run before the public-path / auth-gate logic so
  // that `/login` (legacy) becomes `/login` (current public path).
  if (pathname === LEGACY_ADMIN_PREFIX || pathname.startsWith(`${LEGACY_ADMIN_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === LEGACY_ADMIN_PREFIX ? '/' : pathname.slice(LEGACY_ADMIN_PREFIX.length);
    return NextResponse.redirect(url, 301);
  }

  // Setup redirect: when no users exist, redirect unauthenticated requests to /setup.
  // Uses a lightweight cookie probe — the setup page itself calls GET /api/setup to confirm.
  // Once setup completes and a session cookie exists, this path is never taken again.
  if (pathname === '/' || pathname === '/login') {
    const session = request.cookies.get('revealui-session')?.value;
    const setupDone = request.cookies.get('revealui-setup-done')?.value;
    if (!(session || setupDone)) {
      // Check the setup API to see if setup is needed (lightweight JSON call)
      try {
        const origin = request.nextUrl.origin;
        const checkRes = await fetch(`${origin}/api/setup`, {
          headers: { 'x-internal-proxy': '1' },
        });
        if (checkRes.ok) {
          const data = await checkRes.json();
          if (data.needed === true) {
            const setupUrl = request.nextUrl.clone();
            setupUrl.pathname = '/setup';
            return NextResponse.redirect(setupUrl);
          }
        }
      } catch {
        // If check fails, fall through to normal auth flow
      }
    }
  }

  // Bookmark / stale email path: Payload's [[...segments]] catch-all rendered
  // the dashboard at this URL. Send it to the real license page.
  if (
    pathname === '/settings/account/license' ||
    pathname.startsWith('/settings/account/license/')
  ) {
    const licenseUrl = request.nextUrl.clone();
    licenseUrl.pathname = '/account/license';
    return NextResponse.redirect(licenseUrl, 301);
  }

  // Already-authenticated users have no reason to see the login/signup screens.
  // Honor a safe same-origin redirect/returnUrl so a license CTA is not dumped
  // on admin home `/` (search used to be wiped unconditionally).
  if (pathname === '/login' || pathname === '/signup') {
    const session = request.cookies.get('revealui-session')?.value;
    const role = request.cookies.get('revealui-role')?.value;
    if (session && role) {
      const destUrl = request.nextUrl.clone();
      const requested = safePostAuthRedirect(
        request.nextUrl.searchParams.get('redirect') ??
          request.nextUrl.searchParams.get('returnUrl'),
        request.nextUrl.origin,
      );
      if (requested) {
        const parsed = new URL(requested, request.nextUrl.origin);
        destUrl.pathname = parsed.pathname;
        destUrl.search = parsed.search;
        destUrl.hash = parsed.hash;
      } else {
        destUrl.pathname = ADMIN_ROLES.has(role) ? '/' : '/welcome';
        destUrl.search = '';
      }
      return NextResponse.redirect(destUrl);
    }
  }

  // Auth gate: protect (backend) pages. Every path that isn't public and
  // isn't internal needs an authenticated session. Admin-only paths
  // (/settings, /users) additionally require an admin role. The role cookie
  // is a defense-in-depth UI hint — real enforcement is at the API level via
  // collection access.read checks.
  const isInternal = pathname.startsWith('/api/') || pathname.startsWith('/_next/');
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith('/legal/');
  if (!(isInternal || isPublic)) {
    const session = request.cookies.get('revealui-session')?.value;
    if (!session) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-aware gate: admin-only paths require owner/admin/super-admin.
    // All other authenticated paths are open to any role.
    if (isAdminOnlyPath(pathname)) {
      const role = request.cookies.get('revealui-role')?.value;
      if (!(role && ADMIN_ROLES.has(role))) {
        const welcomeUrl = request.nextUrl.clone();
        welcomeUrl.pathname = '/welcome';
        welcomeUrl.search = '';
        welcomeUrl.searchParams.set('denied', 'admin');
        return NextResponse.redirect(welcomeUrl);
      }
    }

    // Password rotation enforcement — block protected pages until password is changed
    const mustRotate = request.cookies.get('revealui-must-rotate')?.value;
    if (mustRotate === '1') {
      const rotateUrl = request.nextUrl.clone();
      rotateUrl.pathname = '/rotate-password';
      return NextResponse.redirect(rotateUrl);
    }
  }

  // Fleet-mode page guard: upgrade and billing pages are SaaS-only surfaces.
  // Fleet kits ship with a forge license rather than a Stripe subscription;
  // redirect these routes to / (the admin home) so fleet users don't see Stripe checkout UI.
  if (
    process.env.REVEALUI_FLEET_MODE === 'true' &&
    (pathname === '/upgrade' || pathname === '/account/billing')
  ) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  // Strip overrideAccess from external API requests — only server-side code may use it.
  // This prevents clients from bypassing collection access control via query parameter.
  if (pathname.startsWith('/api') && request.nextUrl.searchParams.has('overrideAccess')) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('overrideAccess');
    const rewriteResponse = NextResponse.rewrite(url);
    rewriteResponse.headers.set('Content-Security-Policy', cspValue);
    return rewriteResponse;
  }

  // CORS Handling and Security Headers for API requests
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    const origin = request.headers.get('origin');

    // CORS headers — only set when origin is in the allowed list
    if (allowedOrigins.includes(String(origin))) {
      response.headers.set('Access-Control-Allow-Origin', String(origin));
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS, PUT, PATCH, DELETE',
      );
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS — enforce HTTPS in production
    if (process.env.NODE_ENV !== 'development') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // Content Security Policy — unified per-request policy (see ./lib/security/csp.ts);
    // the single CSP source for both page and /api responses.
    response.headers.set('Content-Security-Policy', cspValue);

    // Handle preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: response.headers });
    }

    const sessionValue = request.cookies.get('revealui-session')?.value;
    const secret = process.env.REVEALUI_SECRET;

    if (sessionValue && secret && UNSAFE_METHODS.has(request.method) && !isCsrfExempt(pathname)) {
      const tokenHeader = request.headers.get('X-CSRF-Token');
      if (!tokenHeader) {
        return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
      }
      let decodedToken: string;
      try {
        decodedToken = decodeURIComponent(tokenHeader);
      } catch {
        decodedToken = tokenHeader;
      }
      const valid = await validateCsrfToken(decodedToken, sessionValue, secret);
      if (!valid) {
        return NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
      }
    }

    await ensureCsrfCookie(request, response);

    return response;
  }

  // Page routes: thread the nonce via request headers so Next.js applies it to
  // its inline bootstrap scripts, and set the matching CSP on the response.
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspValue);
  // Mint/refresh the CSRF token cookie on page loads too. The billing,
  // marketplace, and agents pages call the api server (cross-origin) directly
  // from the browser  -  those fetches never traverse this proxy, so issuing
  // only on same-origin /api responses would leave the first unsafe call
  // after a fresh sign-in without a token.
  await ensureCsrfCookie(request, response);
  return response;
}

/**
 * Ensure the JS-readable `revealui-csrf` cookie holds a token that validates
 * against the CURRENT session cookie value. Issues on first contact and
 * re-issues after session rotation (re-login, recovery, privilege change)  -
 * issue-only-when-missing left a stale binding 403-ing every unsafe call for
 * up to the cookie's 24h lifetime. The same token authorizes unsafe requests
 * to the admin's own /api routes (validated above) and to the api server's
 * csrfMiddleware (validated there against the same cookie value).
 */
async function ensureCsrfCookie(request: NextRequest, response: NextResponse): Promise<void> {
  const sessionValue = request.cookies.get('revealui-session')?.value;
  const secret = process.env.REVEALUI_SECRET;
  if (!(sessionValue && secret)) return;
  const existing = request.cookies.get('revealui-csrf')?.value;
  if (existing && (await validateCsrfToken(existing, sessionValue, secret))) return;
  response.cookies.set('revealui-csrf', await generateCsrfToken(sessionValue, secret), {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

// Define matcher configuration for Next.js proxy
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - and common image formats.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
