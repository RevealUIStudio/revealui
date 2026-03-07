import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Forge domain-lock middleware for the CMS.
 *
 * When FORGE_LICENSED_DOMAIN is set, every incoming request's Host must match
 * the licensed domain or a subdomain of it. Returns 403 otherwise.
 * Skipped entirely when not running in Forge mode.
 */
export function middleware(request: NextRequest): NextResponse {
  const licensedDomain = process.env.FORGE_LICENSED_DOMAIN?.trim().toLowerCase()

  if (!licensedDomain) {
    return NextResponse.next()
  }

  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? ''

  const allowed =
    host === licensedDomain ||
    host.endsWith(`.${licensedDomain}`) ||
    host === 'localhost' ||
    host === '127.0.0.1'

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'This Forge instance is not licensed for this domain.' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
