export const runtime = 'nodejs';

import crypto from 'node:crypto';
import config from '@revealui/config';
import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * On-demand ISR revalidation endpoint.
 *
 * POST /api/revalidate
 * Header: x-revalidate-secret: <REVEALUI_SECRET>
 * Body:   { tag } | { path } | { collection, slug }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-revalidate-secret');
  const expected = config.reveal.secret;
  if (
    !(
      secret &&
      expected &&
      crypto.timingSafeEqual(
        Buffer.from(secret.padEnd(64, '\0')),
        Buffer.from(expected.padEnd(64, '\0')),
      )
    )
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { collection, slug, tag, path } = body as {
    collection?: string;
    slug?: string;
    tag?: string;
    path?: string;
  };

  if (tag) {
    revalidateTag(tag, 'page');
    return NextResponse.json({ revalidated: true, tag });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  if (collection && slug) {
    revalidateTag(`${collection}:${slug}`, 'page');
    revalidatePath(`/${collection}/${slug}`);
    return NextResponse.json({ revalidated: true, collection, slug });
  }

  return NextResponse.json({ error: 'Provide tag, path, or collection+slug' }, { status: 400 });
}
