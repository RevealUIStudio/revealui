export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { revalidatePath as revalidateDataPath, revalidateTag } from '@revealui/cache';
import config from '@revealui/config';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * On-demand revalidation endpoint.
 *
 * POST /api/revalidate
 * Header: x-revalidate-secret: <REVEALUI_SECRET>
 * Body:   { tag } | { path } | { collection, slug }
 *
 * Tags hit @revealui/cache (GAP-194 3.7a). Paths hit data cache tags/prefixes
 * plus Next Full Route Cache while admin remains on Next.js.
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
    await revalidateTag(tag);
    return NextResponse.json({ revalidated: true, tag });
  }

  if (path) {
    await revalidateDataPath(path);
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  if (collection && slug) {
    // Data tags: both underscore (getCachedDocument) and colon (API contract).
    await revalidateTag([`${collection}_${slug}`, `${collection}:${slug}`]);
    const routePath = `/${collection}/${slug}`;
    await revalidateDataPath(routePath);
    revalidatePath(routePath);
    return NextResponse.json({ revalidated: true, collection, slug });
  }

  return NextResponse.json({ error: 'Provide tag, path, or collection+slug' }, { status: 400 });
}
