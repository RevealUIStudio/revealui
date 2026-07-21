import { getSession } from '@revealui/auth/server';
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { extractRequestContext } from '@/lib/utils/request-context';

// Force dynamic rendering to prevent build-time RevealUI admin initialization
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response('No path provided', { status: 404 });
  }

  // Draft preview is admin-only. Validate the session server-side and check the
  // role — the old gate trusted mere PRESENCE of a `revealui-session` cookie
  // value (forgeable/stale), the same anti-pattern the render path dropped in
  // (frontend)/[slug]/page.tsx. Without this, any authenticated (even a
  // public-signup `user`) or forged-cookie caller could flip the app-wide
  // draft-mode cookie. The render path re-gates draft CONTENT on an admin
  // session, but the enabler must fail closed here too (defence-in-depth).
  const session = await getSession(req.headers, extractRequestContext(req));
  if (!(session && isAdminRole(session.user.role))) {
    return new Response('You are not allowed to preview this page', {
      status: 403,
    });
  }

  const draft = await draftMode();
  draft.enable();
  redirect(path);
}
