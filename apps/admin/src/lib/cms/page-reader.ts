import { getSession, isRecoverySession } from '@revealui/auth/server';
import type { RevealPaginatedResult, RevealRequest } from '@revealui/core/types';
import { headers } from 'next/headers';
import { cache } from 'react';
import { extractRequestContext } from '@/lib/utils/request-context';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

type PageReadContext = {
  session: Awaited<ReturnType<typeof getSession>>;
  req: RevealRequest;
};

/** Request-local session validation shared by public pages and client deliveries. */
export const getPageReadContext = cache(async (): Promise<PageReadContext> => {
  const requestHeaders = await headers();
  const session = await getSession(
    requestHeaders,
    extractRequestContext(new Request('http://localhost', { headers: requestHeaders })),
  );
  return {
    session,
    req:
      session && !isRecoverySession(session) && !session.user.mustRotatePassword
        ? {
            user: {
              id: session.user.id,
              email: session.user.email ?? '',
              roles: [session.user.role],
            },
          }
        : {},
  };
});

/** The canonical typed collection bridge applies current site/page ACL to every read. */
export async function readPageCollection(options: {
  slug?: string;
  siteId?: string;
  publishedOnly?: boolean;
  draft?: boolean;
  page?: number;
  limit?: number;
}): Promise<RevealPaginatedResult> {
  const { req } = await getPageReadContext();
  const revealui = await getRevealUIInstance();
  return revealui.find({
    collection: 'pages',
    req,
    draft: !options.publishedOnly && options.draft === true && Boolean(req.user),
    page: options.page ?? 1,
    limit: options.limit ?? 20,
    where: {
      ...(options.slug ? { slug: { equals: options.slug } } : {}),
      ...(options.siteId ? { siteId: { equals: options.siteId } } : {}),
      ...(options.publishedOnly ? { _status: { equals: 'published' } } : {}),
    },
  });
}
