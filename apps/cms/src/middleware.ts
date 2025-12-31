import { rateLimit, rateLimitConfigs } from "@/lib/middleware/rate-limit"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// Define allowed origins for CORS
const allowedOrigins = process.env.PAYLOAD_WHITELISTORIGINS
  ? process.env.PAYLOAD_WHITELISTORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:4000"]

// Rate limiters for different endpoint types
const authRateLimiter = rateLimit(rateLimitConfigs.auth)
const apiRateLimiter = rateLimit(rateLimitConfigs.api)
const formRateLimiter = rateLimit({
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
})
const uploadRateLimiter = rateLimit({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
})

// Middleware function
export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl

  // Apply rate limiting to authentication endpoints
  if (
    pathname.includes("/api/users/login") ||
    pathname.includes("/api/users/logout") ||
    pathname.includes("/api/users/forgot-password") ||
    pathname.includes("/api/users/reset-password")
  ) {
    const rateLimitResponse = await authRateLimiter(request)
    if (rateLimitResponse) return rateLimitResponse
  }

  // Apply rate limiting to form submission endpoints
  if (
    pathname.includes("/api/forms/") ||
    pathname.includes("/api/form-submissions") ||
    pathname.includes("/api/contact")
  ) {
    const rateLimitResponse = await formRateLimiter(request)
    if (rateLimitResponse) return rateLimitResponse
  }

  // Apply rate limiting to file upload endpoints
  if (
    pathname.includes("/api/upload") ||
    pathname.includes("/api/media") ||
    pathname.includes("/api/files")
  ) {
    const rateLimitResponse = await uploadRateLimiter(request)
    if (rateLimitResponse) return rateLimitResponse
  }

  // Apply rate limiting to general API endpoints (including PayloadCMS endpoints)
  if (pathname.startsWith("/api/")) {
    const rateLimitResponse = await apiRateLimiter(request)
    if (rateLimitResponse) return rateLimitResponse
  }

  // CORS Handling and Security Headers for API requests
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next()
    const origin = request.headers.get("origin")

    // CORS headers
    if (allowedOrigins.includes(String(origin))) {
      response.headers.set("Access-Control-Allow-Origin", String(origin))
    }

    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    )
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    )
    response.headers.set("Access-Control-Allow-Credentials", "true")

    // Security headers
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    )

    // Content Security Policy (CSP)
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.vercel-insights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.openai.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ")

    response.headers.set("Content-Security-Policy", cspHeader)

    // Handle preflight (OPTIONS) requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: response.headers })
    }

    return response
  }

  // Admin Subdomain Handling
  if (hostname.startsWith("admin")) {
    if (pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    if (pathname === "/admin/admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith("/admin")) {
      return NextResponse.next()
    }
  }

  // Main Domain Handling
  if (!hostname.startsWith("admin")) {
    if (pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    if (pathname === "/admin/admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith("/admin")) {
      return NextResponse.next()
    }
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
