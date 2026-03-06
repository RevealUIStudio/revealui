import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Define allowed origins for CORS
const allowedOrigins = process.env.REVEALUI_CORS_ORIGINS
  ? process.env.REVEALUI_CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:4000']

// Proxy function (Next.js 16)
// NOTE: Rate limiting is handled per-route via withRateLimit() in API route handlers.
// Middleware runs in Edge Runtime on Vercel and cannot import Node.js-only modules
// (Drizzle ORM, pg driver, etc.) required by the rate limit storage layer.
export default async function proxy(request: NextRequest): Promise<NextResponse | Response> {
  const { hostname, pathname } = request.nextUrl

  // Auth gate: protect /admin routes — redirect to /login if no session cookie
  // Check both cookie names: revealui-session (new auth) and revealui-token (legacy JWT)
  if (pathname.startsWith('/admin')) {
    const session = request.cookies.get('revealui-session')?.value
    const token = request.cookies.get('revealui-token')?.value
    if (!(session || token)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // CORS Handling and Security Headers for API requests
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next()
    const origin = request.headers.get('origin')

    // CORS headers
    if (allowedOrigins.includes(String(origin))) {
      response.headers.set('Access-Control-Allow-Origin', String(origin))
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // Content Security Policy (CSP)
    const cspHeader = [
      "default-src 'self'",
      `script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-inline' 'unsafe-eval'" : ''} https://js.stripe.com https://cdn.vercel-insights.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ')

    response.headers.set('Content-Security-Policy', cspHeader)

    // Handle preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: response.headers })
    }

    return response
  }

  // Admin subdomain: redirect root to /admin (auth gate above handles login check)
  if (hostname.startsWith('admin') && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // Fix double-admin path
  if (pathname === '/admin/admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Define matcher configuration for Next.js middleware
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
}
