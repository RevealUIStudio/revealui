import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COMMUNITY_REDIRECT = 'https://revnation.discourse.group';

// Next.js 16 proxy convention (src/proxy.ts)
export default function proxy(request: NextRequest): NextResponse | undefined {
  const host = request.headers.get('host') ?? '';

  // Redirect community.revealui.com → Discourse forum
  if (host.startsWith('community.')) {
    return NextResponse.redirect(COMMUNITY_REDIRECT, 301);
  }

  return undefined;
}

export const config = {
  matcher: '/:path*',
};
