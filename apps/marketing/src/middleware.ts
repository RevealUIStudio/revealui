import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COMMUNITY_REDIRECT = 'https://github.com/RevealUIStudio/revealui/discussions';

export function middleware(request: NextRequest): NextResponse | undefined {
  const host = request.headers.get('host') ?? '';

  // Redirect community.revealui.com → GitHub Discussions
  if (host.startsWith('community.')) {
    return NextResponse.redirect(COMMUNITY_REDIRECT, 301);
  }

  return undefined;
}

export const config = {
  matcher: '/:path*',
};
