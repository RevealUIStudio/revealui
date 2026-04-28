import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Define allowed origins for CORS
const allowedOrigins = process.env.REVEALUI_CORS_ORIGINS
  ? process.env.REVEALUI_CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:4000'];

// Public paths in the (frontend) route group: no session required.
// Any (backend) page resolves to a path that is NOT in this set and is NOT
// internal (`/api/`, `/_next/`), so the auth gate kicks in.
const PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/mfa',
  '/rotate-password',
  '/forgot-password',
  '/reset-password',
  '/setup',
]);

// Legacy /* paths from before the URL flatten — 301 to flat path.
// Catches stale bookmarks and any external links we didn't update.
const LEGACY_ADMIN_PREFIX = '';

// Next.js 16 proxy convention (src/proxy.ts)
// NOTE: Rate limiting is handled per-route via withRateLimit() in API route handlers.
// Proxy runs in Edge Runtime on Vercel and cannot import Node.js-only modules
// (Drizzle ORM, pg driver, etc.) required by the rate limit storage layer.
export default async function proxy(request: NextRequest): Promise<NextResponse | Response> {
  const { pathname } = request.nextUrl;

  // Forge domain-lock: when FORGE_LICENSED_DOMAIN is set, reject requests from
  // unlicensed domains. Skipped entirely when not running in Forge mode.
  const licensedDomain = process.env.FORGE_LICENSED_DOMAIN?.trim().toLowerCase();
  if (licensedDomain) {
    const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? '';
    const allowed =
      host === licensedDomain ||
      host.endsWith(`.${licensedDomain}`) ||
      host === 'localhost' ||
      host === '127.0.0.1';
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'This Forge instance is not licensed for this domain.' }),
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

  // Auth gate: protect (backend) pages — every path that isn't public and
  // isn't internal needs a session + admin role. The role cookie is a
  // defense-in-depth UI hint (set at login). Real enforcement is at the API
  // level via collection access.read checks.
  const isInternal = pathname.startsWith('/api/') || pathname.startsWith('/_next/');
  const isPublic = PUBLIC_PATHS.has(pathname);
  if (!(isInternal || isPublic)) {
    const session = request.cookies.get('revealui-session')?.value;
    if (!session) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = request.cookies.get('revealui-role')?.value;
    if (role !== 'admin') {
      // User is authenticated but not admin — redirect to login (no admin home for non-admins)
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    // Password rotation enforcement — block protected pages until password is changed
    const mustRotate = request.cookies.get('revealui-must-rotate')?.value;
    if (mustRotate === '1') {
      const rotateUrl = request.nextUrl.clone();
      rotateUrl.pathname = '/rotate-password';
      return NextResponse.redirect(rotateUrl);
    }
  }

  // Strip overrideAccess from external API requests — only server-side code may use it.
  // This prevents clients from bypassing collection access control via query parameter.
  if (pathname.startsWith('/api') && request.nextUrl.searchParams.has('overrideAccess')) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('overrideAccess');
    return NextResponse.rewrite(url);
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

    // Content Security Policy (CSP)
    const cspHeader = [
      "default-src 'self'",
      `script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-inline' 'unsafe-eval'" : ''} https://js.stripe.com https://cdn.vercel-insights.com`,
      `style-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-inline'" : ''}`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    response.headers.set('Content-Security-Policy', cspHeader);

    // Handle preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: response.headers });
    }

    return response;
  }

  return NextResponse.next();
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
