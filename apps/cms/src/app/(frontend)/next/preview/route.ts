import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const session = req.cookies.get('revealui-session')?.value;
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response('No path provided', { status: 404 });
  }

  if (!session) {
    return new Response('You are not allowed to preview this page', {
      status: 403,
    });
  }

  const draft = await draftMode();
  draft.enable();
  redirect(path);
}
